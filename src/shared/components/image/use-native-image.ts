import { useEffect, useMemo, useRef, useState } from 'react';

import { ImageRequest } from '/@/shared/types/domain-types';

type FetchPriority = 'auto' | 'high' | 'low';

interface NativeImageState {
    displaySrc?: string;
    status: 'error' | 'idle' | 'loaded' | 'loading';
}

interface SharedImageRequest {
    controller: AbortController;
    promise: Promise<Blob>;
    refs: number;
}

interface UseNativeImageArgs {
    enabled: boolean;
    fetchPriority?: FetchPriority;
    onFetchError?: () => void;
    request?: ImageRequest | null;
}

// Keep decoded artwork around for the session so remounts, virtualization and
// duplicate components (list + sidebar + player bar) share one network request.
const IMAGE_CACHE_MAX_BYTES = 64 * 1024 * 1024;
const imageBlobCache = new Map<string, Blob>();
const sharedImageRequests = new Map<string, SharedImageRequest>();
let imageBlobCacheBytes = 0;

const getCachedImageBlob = (signature: string) => {
    const blob = imageBlobCache.get(signature);

    if (!blob) {
        return undefined;
    }

    // Refresh insertion order so eviction drops the least recently used entry.
    imageBlobCache.delete(signature);
    imageBlobCache.set(signature, blob);

    return blob;
};

const storeCachedImageBlob = (signature: string, blob: Blob) => {
    const existing = imageBlobCache.get(signature);
    if (existing) {
        imageBlobCacheBytes -= existing.size;
        imageBlobCache.delete(signature);
    }

    imageBlobCache.set(signature, blob);
    imageBlobCacheBytes += blob.size;

    while (imageBlobCacheBytes > IMAGE_CACHE_MAX_BYTES) {
        const oldest = imageBlobCache.entries().next().value;
        if (!oldest) {
            break;
        }

        imageBlobCache.delete(oldest[0]);
        imageBlobCacheBytes -= oldest[1].size;
    }
};

const acquireSharedImage = (
    signature: string,
    request: ImageRequest,
    init: RequestInit & { priority?: FetchPriority },
) => {
    let entry = sharedImageRequests.get(signature);

    if (!entry) {
        const controller = new AbortController();
        const promise = (async () => {
            const response = await fetch(request.url, { ...init, signal: controller.signal });

            if (!response.ok) {
                throw new Error(`Failed to load image: ${response.status}`);
            }

            const blob = await response.blob();
            storeCachedImageBlob(signature, blob);
            return blob;
        })().finally(() => {
            if (sharedImageRequests.get(signature) === entry) {
                sharedImageRequests.delete(signature);
            }
        });

        entry = { controller, promise, refs: 0 };
        sharedImageRequests.set(signature, entry);
    }

    const acquiredEntry = entry;
    acquiredEntry.refs += 1;
    let released = false;

    return {
        promise: acquiredEntry.promise,
        release: () => {
            if (released) {
                return;
            }
            released = true;
            acquiredEntry.refs -= 1;

            if (acquiredEntry.refs > 0) {
                return;
            }

            // Abort only once every consumer has gone away, so one unmounting
            // row does not cancel an image another row is still waiting for.
            if (sharedImageRequests.get(signature) === acquiredEntry) {
                sharedImageRequests.delete(signature);
            }
            acquiredEntry.controller.abort();
        },
    };
};

export function useNativeImage({
    enabled,
    fetchPriority,
    onFetchError,
    request,
}: UseNativeImageArgs) {
    const loadedRequestSignatureRef = useRef<null | string>(null);
    const objectUrlRef = useRef<null | string>(null);
    const onFetchErrorRef = useRef(onFetchError);
    const [state, setState] = useState<NativeImageState>({ status: 'idle' });

    const requestSignature = useMemo(() => {
        if (!request) {
            return null;
        }

        return JSON.stringify({
            cacheKey: request.cacheKey,
            credentials: request.credentials,
            headers: request.headers,
            url: request.url,
        });
    }, [request]);

    onFetchErrorRef.current = onFetchError;

    useEffect(() => {
        let requestActive = true;

        const revokeObjectUrl = () => {
            if (!objectUrlRef.current) {
                return;
            }

            URL.revokeObjectURL(objectUrlRef.current);
            objectUrlRef.current = null;
            loadedRequestSignatureRef.current = null;
        };

        if (!request || !requestSignature) {
            revokeObjectUrl();
            setState({ status: 'idle' });
            return;
        }

        if (!enabled) {
            setState((currentState) =>
                currentState.displaySrc
                    ? { ...currentState, status: 'loaded' }
                    : { status: 'idle' },
            );
            return;
        }

        if (loadedRequestSignatureRef.current === requestSignature && objectUrlRef.current) {
            setState({ displaySrc: objectUrlRef.current, status: 'loaded' });
            return;
        }

        revokeObjectUrl();

        const cachedBlob = getCachedImageBlob(requestSignature);
        if (cachedBlob) {
            const objectUrl = URL.createObjectURL(cachedBlob);
            objectUrlRef.current = objectUrl;
            loadedRequestSignatureRef.current = requestSignature;
            setState({ displaySrc: objectUrl, status: 'loaded' });
            return;
        }

        setState({ status: 'loading' });

        const init = {
            credentials: request.credentials,
            headers: request.headers,
        } as RequestInit & { priority?: FetchPriority };

        if (fetchPriority) {
            init.priority = fetchPriority;
        }

        const sharedImage = acquireSharedImage(requestSignature, request, init);

        void sharedImage.promise
            .then((blob) => {
                if (!requestActive) {
                    return;
                }

                const objectUrl = URL.createObjectURL(blob);
                objectUrlRef.current = objectUrl;
                loadedRequestSignatureRef.current = requestSignature;
                setState({ displaySrc: objectUrl, status: 'loaded' });
            })
            .catch(() => {
                if (!requestActive) {
                    return;
                }

                revokeObjectUrl();
                setState({ status: 'error' });
                onFetchErrorRef.current?.();
            });

        return () => {
            requestActive = false;
            sharedImage.release();
        };
    }, [enabled, fetchPriority, request, requestSignature]);

    useEffect(() => {
        return () => {
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
            }
        };
    }, []);

    return {
        displaySrc: state.displaySrc,
        isError: state.status === 'error',
        isLoaded: state.status === 'loaded',
        isLoading: state.status === 'loading',
    };
}
