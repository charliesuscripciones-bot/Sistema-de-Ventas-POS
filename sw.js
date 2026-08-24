const CACHE_NAME = "POS-SISTEMA-VENTAS-V6";

const APP_SHELL = [
  "./",
  "./index.html",
  "./sw.js",
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
      .then(cache => {

        return cache.addAll(
          APP_SHELL.filter(Boolean)
        );

      })
      .catch(error => {

        console.warn(
          "No se pudo guardar todo el App Shell:",
          error
        );

      })

  );

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
            .filter(
              cacheName =>
                cacheName.startsWith(
                  "POS-SISTEMA-VENTAS-"
                ) &&
                cacheName !== CACHE_NAME
            )
            .map(
              cacheName =>
                caches.delete(cacheName)
            )

        );

      })
      .then(() =>
        self.clients.claim()
      )

  );

});

/* =====================================================
   FETCH
===================================================== */

self.addEventListener("fetch", event => {

  const request =
    event.request;

  /*
    Solo manejamos solicitudes GET.
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
    Supabase, APIs y otras solicitudes externas
    NO se almacenan en el Service Worker.

    Esto es importante porque los datos de productos,
    clientes, ventas, etc. los maneja index.html
    mediante localStorage + Supabase.
  */

  if(
    url.origin !==
    self.location.origin
  ){

    return;

  }

  /*
    Para archivos de la aplicación:

    1. Intentar red.
    2. Guardar la versión nueva en cache.
    3. Si no hay Internet, usar cache.
  */

  event.respondWith(

    fetch(request)

      .then(response => {

        /*
          Solo guardamos respuestas válidas.
        */

        if(
          response &&
          response.status === 200 &&
          response.type === "basic"
        ){

          const copy =
            response.clone();

          caches.open(
            CACHE_NAME
          )
          .then(cache => {

            cache.put(
              request,
              copy
            );

          });

        }

        return response;

      })

      .catch(() => {

        /*
          OFFLINE:
          Primero intentamos encontrar exactamente
          la solicitud solicitada.
        */

        return caches.match(
          request
        )
        .then(cachedResponse => {

          if(cachedResponse){

            return cachedResponse;

          }

          /*
            Si no existe exactamente,
            para navegación regresamos index.html.
          */

          if(
            request.mode === "navigate"
          ){

            return caches.match(
              "./index.html"
            );

          }

          /*
            Si tampoco existe,
            devolvemos una respuesta offline.
          */

          return new Response(

            "Sin conexión a Internet.",

            {
              status:503,
              statusText:"Offline",
              headers:{
                "Content-Type":
                  "text/plain; charset=utf-8"
              }
            }

          );

        });

      })

  );

});

/* =====================================================
   MENSAJES DESDE index.html
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
      Permite que index.html solicite
      una actualización inmediata.
    */

    if(
      event.data.type ===
      "SKIP_WAITING"
    ){

      self.skipWaiting();

    }

    /*
      Permite limpiar completamente
      el cache de la aplicación si fuese necesario.
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
                .filter(
                  name =>
                    name.startsWith(
                      "POS-SISTEMA-VENTAS-"
                    )
                )
                .map(
                  name =>
                    caches.delete(name)
                )

            );

          })

      );

    }

  }
);