const CACHE_NAME = "POS-SISTEMA-VENTAS-V7";

/* =====================================================
   ARCHIVOS PRINCIPALES DE LA APLICACIÓN
===================================================== */

const APP_SHELL = [
  "./",
  "./index.html",
  "./sw.js",

  /* Páginas del POS */
  "./dashboard.html",
  "./clientes.html",
  "./historial.html",
  "./inventario.html",
  "./cuentas.html",

  /* Archivos PWA, si existen */
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

/* =====================================================
   INSTALACIÓN
===================================================== */

self.addEventListener("install", event => {

  event.waitUntil(

    caches.open(CACHE_NAME)
      .then(async cache => {

        /*
          Guardamos cada archivo individualmente.

          Esto evita que si uno de los archivos todavía
          no existe en GitHub, falle todo el proceso de
          instalación del Service Worker.
        */

        for (const file of APP_SHELL) {

          try {

            await cache.add(file);

          }

          catch (error) {

            console.warn(
              "No se pudo guardar en cache:",
              file,
              error
            );

          }

        }

      })

  );

  /*
    Hace que la nueva versión del Service Worker
    quede disponible inmediatamente.
  */

  self.skipWaiting();

});

/* =====================================================
   ACTIVACIÓN
===================================================== */

self.addEventListener("activate", event => {

  event.waitUntil(

    caches.keys()
      .then(cacheNames => {

        return Promise.all(

          cacheNames
            .filter(cacheName => {

              return (

                cacheName.startsWith(
                  "POS-SISTEMA-VENTAS-"
                )

                &&

                cacheName !==
                CACHE_NAME

              );

            })

            .map(cacheName => {

              return caches.delete(
                cacheName
              );

            })

        );

      })

      .then(() => {

        /*
          Controlamos inmediatamente todas las páginas
          abiertas de la aplicación.
        */

        return self.clients.claim();

      })

  );

});

/* =====================================================
   FETCH
===================================================== */

self.addEventListener(
  "fetch",
  event => {

    const request =
      event.request;

    /*
      Solo interceptamos GET.

      Las operaciones POST/PUT/PATCH/DELETE de Supabase
      deben seguir manejándose desde index.html.
    */

    if(
      request.method !== "GET"
    ){

      return;

    }

    const url =
      new URL(
        request.url
      );

    /*
      Solo manejamos archivos de nuestra propia aplicación.

      Supabase y otros dominios externos NO se interceptan.
    */

    if(
      url.origin !==
      self.location.origin
    ){

      return;

    }

    /*
      Estrategia:

      ONLINE
      ↓
      Intentar red
      ↓
      Actualizar cache
      ↓
      Entregar archivo

      OFFLINE
      ↓
      Usar cache
    */

    event.respondWith(

      fetch(request)

        .then(response => {

          /*
            Guardamos únicamente respuestas válidas.
          */

          if(
            response &&
            response.status === 200 &&
            response.type === "basic"
          ){

            const responseClone =
              response.clone();

            caches.open(
              CACHE_NAME
            )
            .then(cache => {

              cache.put(
                request,
                responseClone
              );

            })
            .catch(error => {

              console.warn(
                "No se pudo actualizar cache:",
                error
              );

            });

          }

          return response;

        })

        .catch(() => {

          /*
            =============================================
            MODO OFFLINE
            =============================================
          */

          return caches.match(
            request
          )
          .then(cachedResponse => {

            if(
              cachedResponse
            ){

              return cachedResponse;

            }

            /*
              Si la solicitud era una navegación y
              no encontramos exactamente la página,
              intentamos devolver index.html.
            */

            if(
              request.mode ===
              "navigate"
            ){

              return caches.match(
                "./index.html"
              )
              .then(indexResponse => {

                if(
                  indexResponse
                ){

                  return indexResponse;

                }

                return offlineResponse();

              });

            }

            return offlineResponse();

          });

        })

    );

  }
);

/* =====================================================
   RESPUESTA OFFLINE
===================================================== */

function offlineResponse(){

  return new Response(

    `
      <!DOCTYPE html>

      <html lang="es">

      <head>

        <meta charset="UTF-8">

        <meta
          name="viewport"
          content="width=device-width,initial-scale=1.0"
        >

        <title>POS Offline</title>

        <style>

          body{
            margin:0;
            min-height:100vh;
            display:flex;
            align-items:center;
            justify-content:center;
            font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
            background:#f5f5f5;
            color:#222;
            text-align:center;
            padding:25px;
          }

          .box{
            background:white;
            padding:30px;
            border-radius:20px;
            box-shadow:0 5px 25px rgba(0,0,0,.1);
            max-width:400px;
          }

          h1{
            font-size:28px;
            margin-bottom:15px;
          }

          p{
            font-size:17px;
            line-height:1.5;
            color:#666;
          }

        </style>

      </head>

      <body>

        <div class="box">

          <h1>
            📴 Sin conexión
          </h1>

          <p>
            Esta sección todavía no está disponible
            offline.
          </p>

          <p>
            Regresa al inicio del POS.
          </p>

        </div>

      </body>

      </html>
    `,

    {
      status:503,
      statusText:"Offline",
      headers:{
        "Content-Type":
          "text/html; charset=utf-8"
      }
    }

  );

}

/* =====================================================
   MENSAJES DESDE LA APLICACIÓN
===================================================== */

self.addEventListener(
  "message",
  event => {

    if(
      !event.data
    ){

      return;

    }

    /*
      Actualizar Service Worker inmediatamente.
    */

    if(
      event.data.type ===
      "SKIP_WAITING"
    ){

      self.skipWaiting();

    }

    /*
      Limpiar cache de la aplicación.
    */

    if(
      event.data.type ===
      "CLEAR_APP_CACHE"
    ){

      event.waitUntil(

        caches.keys()
          .then(cacheNames => {

            return Promise.all(

              cacheNames
                .filter(name => {

                  return name.startsWith(
                    "POS-SISTEMA-VENTAS-"
                  );

                })
                .map(name => {

                  return caches.delete(
                    name
                  );

                })

            );

          })

      );

    }

    /*
      Forzar actualización de todos los archivos
      del App Shell.
    */

    if(
      event.data.type ===
      "UPDATE_APP_CACHE"
    ){

      event.waitUntil(

        caches.open(
          CACHE_NAME
        )
        .then(async cache => {

          for(
            const file of APP_SHELL
          ){

            try{

              const response =
                await fetch(
                  file,
                  {
                    cache:"no-store"
                  }
                );

              if(
                response.ok
              ){

                await cache.put(
                  file,
                  response
                );

              }

            }

            catch(error){

              console.warn(
                "No se pudo actualizar:",
                file,
                error
              );

            }

          }

        })

      );

    }

  }
);

/* =====================================================
   CONTROLAR NUEVAS PESTAÑAS / PÁGINAS
===================================================== */

self.addEventListener(
  "controllerchange",
  () => {

    console.log(
      "POS: nuevo Service Worker activo."
    );

  }
);