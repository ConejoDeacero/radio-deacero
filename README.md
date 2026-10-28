# DEACERO Play Lite

Reproductor local de música aleatoria. Cada 4–6 canciones salta a un género al azar
(479 géneros; el azar usa los 79 destacados). Controles grandes para pantalla táctil,
modo solo audio / video, letra sincronizada, visualizador, **podcasts** y **control remoto** (comando `play` y web `/remote`).
Sin base de datos, sin login, **sin dependencias de npm**: solo Node ≥ 18 y `yt-dlp`.

## Uso en tu PC

```bash
pip install -U yt-dlp      # o el binario de yt-dlp en el PATH
npm start                  # http://localhost:8000
npm test                   # 162 pruebas, sin red
```

| Variable | Defecto | Para qué |
|---|---|---|
| `PORT` | `8000` | Puerto (en Linux no puede ser < 1024 sin root) |
| `HOST` | `127.0.0.1` | `0.0.0.0` para controlarlo desde otro equipo **de tu red** |
| `DATA_DIR` | `./data` | Dónde se guardan los podcasts (`podcasts.json`) |
| `REMOTE_TOKEN` | — | Clave para quien no sea la propia máquina (header `x-token` o `?t=`). **Defínela si `HOST=0.0.0.0`** |
| `YTDLP_BIN` | autodetectado | Ruta de yt-dlp si no está en el PATH |
| `YTDLP_EXTRA` | — | Opciones extra, p. ej. `--cookies /ruta/cookies.txt` |

`?vis=0` en la URL apaga el visualizador (por si la Pi va justa).
`?mode=audio` (por defecto) o `?mode=video` fija el modo de arranque (en la vista `/kiosco` el defecto es video). El kiosco de la Pi usa `http://localhost:8000/?mode=audio` (solo música): Chromium se
cierra a la fuerza y no siempre guarda el último modo elegido, así que el parámetro asegura cómo arranca tras cada reinicio.

## Dos vistas

| Dirección | Vista |
|---|---|
| `/` | Reproductor normal: carátula o video a un lado, controles al otro. |
| `/kiosco` | **Vista kiosco, solo para ver**: el video de fondo a pantalla completa, difuminado (se distingue el video, sin detalle), y al frente la **hora en grande** (12 h con AM/PM, segundos y fecha), la canción y la que sigue. No tiene botones, barra de progreso, volumen, género ni dirección de control, y el teclado no hace nada: todo se maneja desde `/remote` (o `play`). Con `?mode=audio` el fondo es la carátula difuminada en vez del video. |

El desenfoque no usa `filter: blur` (a 1080p hace tropezar a una Raspberry Pi): el video se dibuja en un mosaico de 96×54 px y el navegador lo escala a pantalla
completa. (Con 32×18 px se veían solo manchas; con 96×54 se reconoce la imagen.) La medición de una Pi 4B (30 fps, ~19 % de CPU) fue con 32×18 y no se repitió con 96×54.

**La hora está corregida:** una Pi sin reloj de hardware (y con NTP bloqueado) se atrasa —la de pruebas iba **7 días** atrasada—, y un reloj enorme en pantalla lo
delataría. El servidor calcula el desfase con la cabecera `Date` de las respuestas HTTPS de YouTube/Google (`src/timesync.js`, cada 10 min) y la vista kiosco
muestra la hora real (`GET /api/time`). No cambia el reloj del sistema (eso pide root); si no logra sincronizar, la vista usa el reloj local.

Para que la Pi arranque en la vista kiosco: `~/DEACEROPLAY-lite/deploy/install-autostart.sh "http://localhost:8000/kiosco"` y reiniciar el kiosco.

## Controles en pantalla

| Tecla | Acción | | Tecla | Acción |
|---|---|---|---|---|
| Espacio | Pausa / play | | `V` | Audio / video |
| `←` / `P` | Anterior | | `L` | Letra |
| `→` / `N` | Siguiente | | `G` | Elegir género |
| `↑` `↓` | Volumen | | `R` | Otro género al azar |
| `M` | Silenciar | | `I` | Ver la dirección de control (o tocar el logo) |
| | | | `Esc` | Cerrar paneles |

Todo se hace también tocando. El selector de géneros tiene buscador.

## Control remoto

**Por terminal / SSH** — comando `play` (en la Pi: `ssh admin@IP play next`):

```
play status                  qué suena        play genre jazz       fijar género (id o texto)
play next | prev             siguiente/ant.   play genres [texto]   listar / buscar géneros
play toggle | pause | resume pausa/play       play search bad bunny tocar UNA vez una canción/artista
play podcast radio ambulante tocar un episodio     play podcasts         podcasts guardados
play find [192.168.1.0/24]    buscar la Pi si cambió de IP
play clients                 qué equipos hay conectados (pantallas y controles)
play history [n]             últimas búsquedas: quién buscó qué y cuándo
play history clear --yes     borrar el historial
play random                  otro género      play vol 70 | +5 | -5 volumen
play mode video | audio      video/audio      play mute | lyrics    silenciar / letra
```

Desde otro equipo, sin SSH: `play -u http://IP:8000 -t CLAVE next` (o `PLAY_URL` / `PLAY_TOKEN`). Es un solo archivo Python
(`deploy/play`, solo biblioteca estándar); funciona también en Windows.

**Por web** — `http://IP-DE-LA-PI:8000/remote` en el celular o la PC: anterior/pausa/siguiente, volumen, video, letra y dos pestañas:
**Música** (tocar una canción/artista una vez y **elegir género** de la lista completa, con filtro en vivo), **Podcasts** (guardar tus podcasts, ver
episodios y tocarlos) y **Equipos** (quién está conectado). El título
de lo que suena se muestra completo. La primera vez pide la clave (o ábrelo con `?t=CLAVE`, se guarda en el navegador).

**Equipos conectados** (pestaña *Equipos* o `play clients`): lista las **pantallas** que reproducen (conexión abierta) y los **controles** que han consultado
o mandado órdenes en los últimos 10 min, con nombre del equipo (DNS de la red; si no lo conoce, solo la IP), IP, tipo de dispositivo (celular, PC, terminal…),
si están **activos** (visto hace < 10 s) y su **última orden**. La pestaña se actualiza sola. Solo se ve quién usa el control, no quién abre la página sin usarlo.

**Quién es cada quien:** un navegador no entrega el usuario de Windows (y, al entrar por IP, ni siquiera manda la sesión de Windows al servidor), así que
**la web no pide ni muestra nombres de persona**: de cada equipo se ve el nombre del equipo (DNS de la red) y su IP. Por **terminal**, `play` manda solo el usuario con
el que iniciaste sesión (se cambia con `PLAY_USER`) y aparece en `play clients` y `play history`. Es un dato declarado por el propio programa, no una autenticación.

**Historial de búsquedas — solo por comandos:** `play history [n]` muestra las últimas búsquedas (canciones/artistas, podcasts buscados, episodios tocados y géneros
elegidos) con quién, desde qué equipo y cuándo; `play history clear --yes` lo borra (de **todos** los equipos). La web no tiene pantalla de historial, pero sus
búsquedas también quedan registradas. Se guardan las últimas 200 en `history.json` (junto a los podcasts). La hora es la del equipo que buscó, porque el reloj de la Pi está mal.

**Pauta única:** una canción buscada o un episodio de podcast suena **una vez** y la lista sigue como estaba (Jazz → [Dua Lipa] → Jazz): no cambia
el género, la racha ni la cola de canciones que ya estaban pedidas. Si pulsas *siguiente* durante la pauta, vuelves a la lista donde iba.

**Cómo funciona:** la música suena en el navegador de la pantalla; el servidor reenvía las órdenes a esa página por
Server-Sent Events (`/api/events`) y guarda lo que la pantalla reporta (`/api/state`). Si no hay ninguna pantalla abierta,
las órdenes responden `409 NO_PLAYER`.

**Varias pantallas:** hoy una orden llega a **todas** las pantallas abiertas y cada una pide sus propias canciones al
servidor (el estado del radio —género y recientes— es uno solo). Está pensado para **una** pantalla.

| API | |
|---|---|
| `POST /api/cmd` | `{cmd: toggle/play/pause/next/prev/random/mute/lyrics}` · `{cmd:'genre',id}` · `{cmd:'volume',set/delta}` · `{cmd:'mode',mode}` · `{cmd:'search',q}` |
| | `{cmd:'track',kind:'podcast'\|'search',track:{id,title,channel,duration}}` toca un episodio/canción concreta (pauta única) |
| `GET /api/state` | qué suena, pausa, volumen, modo, pantallas conectadas |
| `GET/POST /api/podcasts`, `DELETE /api/podcasts/:id` | podcasts guardados (`{name, q}`) |
| `GET /api/podcast/search?q=` | episodios (5 min – 4 h) |
| `GET /api/health` | estado y **direcciones IP** del servidor |
| `GET /api/time` | hora real corregida (`now`), desfase y si está sincronizada |
| `GET /api/clients` | pantallas y controles conectados, y quién eres tú |
| `GET /api/history?limit=`, `DELETE /api/history` | historial de búsquedas |
| cabeceras `x-user` (usuario, codificado) y `x-client-time` (hora real) | las manda `play` (la web solo manda la hora); el servidor las usa para Equipos e historial |
| `GET /api/search?q=` | géneros que coinciden |
| `GET /api/events` | flujo SSE de órdenes (lo usa la pantalla) |

Con `REMOTE_TOKEN` definido, todo `/api/*` (salvo `/api/health`) exige la clave a los clientes remotos; la propia Pi (loopback) no.

## Raspberry Pi (instalación sin `sudo`)

La Pi no alcanza GitHub ni PyPI y `sudo` pide contraseña, así que todo vive en el home del usuario:

| Qué | Dónde |
|---|---|
| Node 22 | `~/.local/lib/node` (enlace `~/.local/bin/node`) |
| yt-dlp (copiado desde el PC, Python puro) | `~/.local/lib/ytdlp` + wrapper `~/.local/bin/yt-dlp` |
| App | `~/DEACEROPLAY-lite` |
| Servicio (usuario) | `~/.config/systemd/user/play-lite.service` (copia de `deploy/play-lite.user.service`) — `systemctl --user status\|restart play-lite` |
| Configuración y clave de red | `~/.config/play-lite.env` (`HOST`, `REMOTE_TOKEN`, `DATA_DIR`) |
| Podcasts e historial | `~/.local/share/play-lite/podcasts.json` y `history.json` |
| Pantalla completa al encender | `~/.config/autostart/play-lite-kiosk.desktop` → `deploy/start-kiosk.sh` |
| Comando `play` | `~/.local/bin/play` (y `~/.bashrc` añade `~/.local/bin` al PATH, también en SSH) |

`loginctl enable-linger` está activo: el servidor arranca aunque nadie inicie sesión.

### Si cambia la IP de la Pi

Si la Pi usa **Wi-Fi/Ethernet con DHCP**, la IP puede cambiar (sobre todo con concesiones cortas). Formas de encontrarla:

1. **`play find`** desde tu PC (escanea la red en ~5 s y muestra la IP, el enlace de control web y el comando SSH). Si no sabe dónde buscar, indícale la red: `play find 192.168.1.0/24`.
2. **En la pantalla de la Pi:** al arrancar se muestra 25 s "Control remoto: http://IP:8000/remote"; después, tocando el logo o con la tecla `I`.
3. **`play status`** (por SSH o desde la web) muestra el enlace de control.

La solución definitiva es una **reserva DHCP** en el router (pide a quien administre la red que ligue la IP a la MAC de la Pi: `ip -o link`), o una IP estática con `nmcli`. El nombre `<host>.local` (mDNS) solo funciona si la red deja pasar multicast.

**Actualizar la app** (desde el PC, en la carpeta del proyecto):
```bash
tar --exclude=.git --exclude=test --exclude=docs -cf - . | ssh admin@IP 'tar -xmf - -C ~/DEACEROPLAY-lite' && ssh admin@IP 'systemctl --user restart play-lite'
```
**Actualizar yt-dlp** (la Pi no puede bajarlo; si las pistas dejan de sonar suele ser esto). En el PC: `pip install -U yt-dlp`, y
```bash
cd "$(python -c 'import yt_dlp,os;print(os.path.dirname(os.path.dirname(yt_dlp.__file__)))')"
tar --exclude=__pycache__ -cf - yt_dlp | ssh admin@IP 'rm -rf ~/.local/lib/ytdlp/yt_dlp && tar -xf - -C ~/.local/lib/ytdlp' && ssh admin@IP 'yt-dlp --version'
```
**Detener / quitar:** `~/DEACEROPLAY-lite/deploy/stop-kiosk.sh` · `rm ~/.config/autostart/play-lite-kiosk.desktop` · `systemctl --user disable --now play-lite`.
`deploy/start-kiosk.sh` acepta `KIOSK_EXTRA_FLAGS` (p. ej. `--remote-debugging-port=9222` para depurar).

Si la pantalla se apaga sola: `sudo raspi-config` → Display Options → Screen Blanking → No.
El reloj de esta Pi iba ~3 h atrasado (NTP bloqueado); la app lo tolera (si una URL caduca antes de tiempo, reintenta).

## Instalar en un PC con Windows (sin administrador)

Sirve igual que la Raspberry Pi: un PC con monitor (o solo servidor) que arranca solo al iniciar sesión.

**Forma fácil (para quien tenga permisos de administrador en ese PC):** copiar el paquete (`radio-deacero-windows.zip`), descomprimirlo y hacer doble clic en
`INSTALAR.cmd` (pide el aviso de administrador una vez). Instala para **todos los usuarios** en `C:\ProgramData\RadioDeacero`, abre la pantalla completa con la vista `/kiosco`
(video difuminado + hora grande), abre el puerto en el firewall y muestra las direcciones y la clave. `DESINSTALAR.cmd` lo quita; `LEEME.txt` trae los pasos. El paquete lleva Node y
`yt-dlp` incluidos en `vendor\` (verificados contra los hashes oficiales), así que instalar no necesita internet (reproducir sí). El zip se arma a partir de este repositorio añadiendo `vendor\`
(no está versionado). Sin ser administrador se puede instalar solo para el usuario actual con `install.ps1`, como sigue. Desde la carpeta del proyecto:

```powershell
powershell -ExecutionPolicy Bypass -File deploy\windows\install.ps1
```

| Opción | Para qué |
|---|---|
| `-View kiosco` | pantalla con el video difuminado de fondo y la hora grande (por defecto, el reproductor normal) |
| `-Mode video` | arrancar con video (por defecto, solo música) |
| `-NoKiosk` | solo servidor: no abre el navegador en pantalla completa |
| `-LocalOnly` | solo ese equipo (sin control desde la red ni clave) |
| `-Port 8000` · `-Token CLAVE` · `-InstallDir ruta` | puerto, clave del control remoto (si se omite se genera una) y carpeta (por defecto `%LOCALAPPDATA%\RadioDeacero`) |
| `-NoAutostart` · `-NoStart` | no crear los accesos de Inicio / no arrancar al terminar (pruebas) |

Qué hace: usa el Node (≥ 18) y el `yt-dlp` que ya haya o descarga copias portátiles (nodejs.org y GitHub; si GitHub está bloqueado, `python -m pip install -U yt-dlp`); copia la app
a `<carpeta>\app` y guarda podcasts e historial aparte en `<carpeta>\data`; crea dos accesos en la carpeta **Inicio** del usuario (el servidor, que se relanza solo si se cae, y la pantalla
completa en Edge o Chrome con un perfil propio); arranca todo y muestra las direcciones y la **clave**. Los logs quedan en `<carpeta>\logs\server.log`.

- **Bajar cambios:** `powershell -ExecutionPolicy Bypass -File "%LOCALAPPDATA%\RadioDeacero\update.ps1"` (el instalador lo copia a la carpeta de instalación). Baja el zip de la rama `main` de GitHub
  (repo público, sin Git ni credenciales) y lo instala encima: conserva clave, puerto, vista, modo, podcasts e historial. `-UpdateYtDlp` actualiza también `yt-dlp.exe`; `-NoStart` no arranca al terminar.
  Hay que haber subido antes los cambios a GitHub. Si el equipo no llega a GitHub, copiar el zip y ejecutar `install.ps1`.
- **Actualizar a mano:** volver a ejecutar `install.ps1` (para el servidor viejo, pone el nuevo y conserva clave, puerto, vista y modo). **Quitar:** `uninstall.ps1` (`-KeepData` conserva podcasts e historial).
- **Control desde otros equipos:** sin ser administrador Windows puede preguntar si permite la conexión la primera vez (aceptar), o crear la regla una vez como administrador
  (el instalador imprime el comando; si se ejecuta ya como administrador la crea solo).
- **Autorun con tarea programada:** `powershell -ExecutionPolicy Bypass -File deploy\windows\autorun.ps1` crea dos tareas (`RadioDeacero-Servidor` y `RadioDeacero-Pantalla`) que
  se lanzan al iniciar sesión el usuario actual, con una espera para que la red esté lista, y quita los accesos de Inicio para no arrancar dos veces. No pide administrador; si Windows no deja crearlas,
  conserva los accesos de Inicio. `-Remove` quita las tareas. Para que arranque «en cuanto se prende» el PC debe iniciar sesión solo (inicio de sesión automático, lo configura IT): sin sesión no hay pantalla.
- **Pantalla completa:** se sale con `Alt+F4`, pero se reabre sola; para pararla del todo, `uninstall.ps1` o cerrar sesión. La hora de la vista `/kiosco` es la del PC.
- El comando `play` (control por terminal) necesita Python; la web `/remote` funciona sin nada más.

## Cómo funciona

```
Navegador ──► /api/next     el "bot" (src/radio.js) elige género y canción (o una búsqueda)
          ──► /api/play/ID  el servidor resuelve con yt-dlp y pasa el audio (o el video) por proxy
          ──► /api/thumb/ID carátula · /api/lyrics letra (lrclib → lyrics.ovh)
```

- El navegador **solo habla con este servidor**: no necesita llegar a `googlevideo.com`.
- El video llega **sin audio** (360p H.264) y se sincroniza con el audio en el navegador, porque YouTube ya no
  sirve archivos combinados y juntarlos exigiría ffmpeg.
- Géneros que solo existen como mezclas de horas (café, ambient, estudio) reproducen una mezcla y luego cambian.
- Si una pista falla se reintenta una vez y luego salta a la siguiente; tras 5 fallos seguidos espera 30 s.
- Los iconos de género son SVG de [Twemoji](https://github.com/jdecked/twemoji) (CC-BY 4.0, ver `public/assets/emoji/LICENSE.txt`):
  la Pi no trae fuente de emoji y no se puede instalar sin `sudo`.

## Estructura

```
server.js            arranque           src/radio.js    elige género/canción/búsqueda
src/server.js        HTTP + estáticos   src/ytdlp.js    búsqueda y URLs (caché por `expire`)
src/stream.js        proxy con Range    src/control.js  órdenes remotas (SSE) y estado
src/clients.js       equipos conectados  src/podcasts.js podcasts guardados
src/timesync.js      hora real (HTTPS)
src/history.js       historial           src/jsonfile.js JSON en disco (atómico)
src/lyrics.js        letras             src/thumb.js    carátulas
public/              interfaz (HTML + CSS + JS, sin build): index.html (pantalla), remote.html (control)
deploy/              play (CLI), start/stop-kiosk.sh, install-autostart.sh, play-lite.user.service (Raspberry Pi)
deploy/windows/      INSTALAR.cmd, DESINSTALAR.cmd, LEEME.txt, install.ps1, uninstall.ps1, run-server.ps1, run-kiosk.ps1 (PC con Windows)
data/genres.json     479 géneros        test/           node:test
```

## Límites conocidos

- Usa `yt-dlp`, que **incumple los términos de servicio de YouTube**; es una decisión de uso personal.
- Se rompe de vez en cuando cuando YouTube cambia algo: actualizar `yt-dlp` suele arreglarlo.
- Cada búsqueda tarda ~4–6 s y resolver una pista ~5 s en la Pi; el cliente precarga 2 pistas. Cambiar a un género nuevo
  puede tardar unos segundos y la pantalla muestra "Buscando música…".
- Un solo oyente: el estado del radio (género, historial reciente) vive en el servidor.
- Los episodios de podcast salen de la búsqueda normal de YouTube con "podcast" añadido (5 min – 4 h); no se puede garantizar el orden por fecha
  (`yt-dlp` ya no soporta `ytsearchdate`). Un episodio puede durar horas: *siguiente* lo salta.
- Si la red bloquea NTP, la hora de la Pi puede ir atrasada (no tiene reloj de hardware).
