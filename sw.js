"use strict";

/*
  =========================================================
  SISTEMA DE VENTAS POS
  SERVICE WORKER v6

  Objetivos:
  - Mantener index.html disponible offline.
  - Mantener dashboard.html disponible offline.
  - Mantener clientes.html disponible offline.
  - Mantener cuentas.html disponible offline.
  - Mantener historial.html disponible offline.
  - Mantener inventario.html disponible offline.
  - No depender de manifest.json.
  - No borrar páginas del caché anterior durante una actualización.
  - Funcionar correctamente en GitHub Pages y Vercel.
  =========================================================
*/

const CACHE_NAME = "pos-cache-v6";

/*
  Archivos que forman parte de la aplicación.
  NO agregamos manifest.json porque actualmente no existe.
*/
const APP_SHELL = [
  "./",
  "./index.html",
  "./dashboard.html",
  "./clientes.html",
  "./cuentas.html",
  "./historial.html",
  "./inventario.html",
  "./sw.js"
];


/* =========================================================
   INSTALL
========================================================= */

self.addEventListener("install", event => {

  console.log(
    "[SW v6] Instalando Service Worker..."
  );

  event.waitUntil(

    caches.open(CACHE_NAME)

      .then(async cache => {

        /*
          Agregamos los archivos uno por uno.

          Esto es intencional:
          si un archivo no existe, no queremos que
          falle TODO el proceso de instalación.
        */

        for (const file of APP_SHELL) {

          try {

            await cache.add(file);

            console.log(
              "[SW v6] Cacheado:",
              file
            );

          }

          catch(error) {

            console.warn(
              "[SW v6] No se pudo cachear:",
              file,
              error
            );

          }

        }

      })

      .then(() => {

        /*
          Activa inmediatamente la nueva versión.
        */

        return self.skipWaiting();

      })

  );

});


/* =========================================================
   ACTIVATE
========================================================= */

self.addEventListener("activate", event => {

  console.log(
    "[SW v6] Activando Service Worker..."
  );

  event.waitUntil(

    caches.keys()

      .then(cacheNames => {

        return Promise.all(

          cacheNames.map(cacheName => {

            /*
              Solamente eliminamos cachés POS
              que sean versiones anteriores.

              NO tocamos otros cachés del navegador.
            */

            if(
              cacheName.startsWith("pos-cache-") &&
              cacheName !== CACHE_NAME
            ){

              console.log(
                "[SW v6] Eliminando caché anterior:",
                cacheName
              );

              return caches.delete(
                cacheName
              );

            }

            return Promise.resolve(false);

          })

        );

      })

      .then(() => {

        /*
          Permite que el nuevo Service Worker
          tome control de las páginas abiertas.
        */

        return self.clients.claim();

      })

  );

});


/* =========================================================
   FETCH
========================================================= */

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
    No interceptamos directamente las solicitudes
    de Supabase/API.

    Esto es importante:
    si estamos offline, dejamos que el código
    de la aplicación maneje el fallback local.
  */

  if(
    url.hostname.includes(
      "supabase.co"
    )
  ){

    return;

  }


  event.respondWith(

    caches.match(
      request
    )

    .then(cachedResponse => {

      /*
        Si ya existe en caché, usamos el archivo
        inmediatamente.
      */

      if(cachedResponse){

        /*
          Para documentos HTML podemos intentar
          actualizar el caché en segundo plano
          cuando exista conexión.
        */

        if(
          request.mode === "navigate" ||
          request.destination === "document"
        ){

          updateCacheInBackground(
            request
          );

        }

        return cachedResponse;

      }


      /*
        Si no está en caché, intentamos Internet.
      */

      return fetch(
        request
      )

      .then(networkResponse => {

        /*
          Solo guardamos respuestas válidas.
        */

        if(
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type !== "opaque"
        ){

          const responseClone =
          networkResponse.clone();

          caches.open(
            CACHE_NAME
          )
          .then(cache => {

            cache.put(
              request,
              responseClone
            );

          });

        }

        return networkResponse;

      })

      .catch(() => {

        /*
          Si estamos offline y el navegador
          está intentando abrir una página,
          devolvemos index.html como último recurso.

          Esto evita una pantalla completamente vacía
          cuando una ruta todavía no fue cacheada.
        */

        if(
          request.mode === "navigate"
        ){

          return caches.match(
            "./index.html"
          );

        }


        /*
          Para otros recursos no inventamos
          una respuesta.
        */

        return new Response(
          "",
          {
            status: 503,
            statusText: "Offline"
          }
        );

      });

    })

  );

});


/* =========================================================
   ACTUALIZACIÓN EN SEGUNDO PLANO
========================================================= */

function updateCacheInBackground(
  request
){

  /*
    No esperamos esta operación.
    La página continúa funcionando con el
    archivo almacenado.
  */

  fetch(
    request
  )

  .then(response => {

    if(
      !response ||
      response.status !== 200
    ){

      return;

    }


    return caches.open(
      CACHE_NAME
    )

    .then(cache => {

      return cache.put(
        request,
        response
      );

    });

  })

  .catch(() => {

    /*
      Sin Internet:
      no hacemos nada.

      El archivo que ya estaba en caché
      permanece intacto.
    */

  });

}


/* =========================================================
   MESSAGE
========================================================= */

self.addEventListener(
  "message",
  event => {

    if(
      event.data &&
      event.data.type ===
      "SKIP_WAITING"
    ){

      self.skipWaiting();

    }

  }
);


/* =========================================================
   ERROR GLOBAL
========================================================= */

self.addEventListener(
  "error",
  event => {

    console.error(
      "[SW v6] Error:",
      event.error || event.message
    );

  }
);


self.addEventListener(
  "unhandledrejection",
  event => {

    console.error(
      "[SW v6] Promise rechazada:",
      event.reason
    );

  }
);