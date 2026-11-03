# NetEase lyrics in the web build

`music.163.com` does not send `Access-Control-Allow-Origin`, so the browser build cannot call it
directly. The web build therefore requests NetEase through a reverse proxy that appends the CORS
headers.

The desktop build is unaffected: it calls `music.163.com` directly from the Electron main process.
Both builds share the same request/parse code in `src/shared/utils/netease-lyrics.ts`.

## Requests the web build makes

| Purpose | URL |
|----------|-----|
| Search | `<base>/api/search/get?limit=5&offset=0&s=<artist name>&type=1` |
| Lyrics | `<base>/api/song/lyric?id=<songId>&kv=-1&lv=-1&tv=-1` |

`<base>` defaults to `https://rumtunes.com/netease/` and can be overridden with the
`NETEASE_API_URL` environment variable (web / Docker only):

```yaml
environment:
    - NETEASE_API_URL=https://rumtunes.com/netease/
```

## Caddy

`handle_path` strips the `/netease` prefix, so the upstream sees the original
`/api/search/get` and `/api/song/lyric` paths.

```caddy
rumtunes.com {
    handle_path /netease/* {
        reverse_proxy https://music.163.com {
            header_up Host music.163.com
            header_up Referer https://music.163.com/
            header_down Access-Control-Allow-Origin "*"
            header_down Access-Control-Allow-Methods "GET, OPTIONS"
            header_down Access-Control-Allow-Headers "*"
        }
    }

    # ... rest of the site
}
```

The lyrics requests are simple `GET`s without custom headers, so no CORS preflight is issued and
`Access-Control-Allow-Origin` alone is enough.

## Translations

`lyrics.enableNeteaseTranslation` merges the NetEase translation (`tlyric`) into the original lyric
(`lrc`). In the desktop build the flag is read from the Electron store; in the web build it is read
from the renderer settings, so the toggle is available in both.
