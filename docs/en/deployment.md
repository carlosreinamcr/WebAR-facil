# Deployment and browser security

Serve production pages and device previews over HTTPS. Desktop loopback URLs can use a secure-context exception. For a phone on your LAN, use an HTTPS host that the phone trusts. Open the page from its served URL so that scripts, models, images and media resolve over HTTP or HTTPS.

| Resource | Deployment check |
| --- | --- |
| SDK | Script returns JavaScript and loads before AR initialization. |
| Marker and model | URLs resolve relative to the document, with exact filename casing. |
| Video | Browser can decode the container and codec. Cross-origin hosting permits access when used as a texture. |
| Camera or microphone | Permission granted by the browser and any enclosing iframe policy. |

If the page is embedded, the host page must allow the required features through its permissions policy and iframe configuration. Open the page directly to isolate iframe restrictions. Use the [troubleshooting guide](troubleshooting.md) to separate network and camera failures.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
