"use strict";

/*
=========================================================
 SERVICE WORKER
 Sistema de Ventas POS
 Offline + Dashboard + navegación
=========================================================
*/

const CACHE_NAME = "pos-cache-v8";

/*
=========================================================
 ARCHIVOS PRINCIPALES
=========================================================
*/

const APP_SHELL = [
  "./",
  "./index.html",
  "./dashboard.html",
  "./clientes.html",
  "./cuentas.html",
  "./historial.html",
  "./inventario.html",
  "./manifest.json",
  "./sw.js"
];

/*
=========================================================
 INSTALACIÓN
=========================================================
*/

self.addEventListener("install", event => {

  event.waitUntil(

    caches.open(CACHE_NAME)

      .then(cache => {

        return cache.addAll(APP_SHELL);

      })

      .then(() => {

        return self.skipWaiting();

      })

  );

});

/*
=========================================================
 ACTIVACIÓN
=========================================================
*/

self.addEventListener("activate", event => {

  event.waitUntil(

    caches.keys()

      .then(keys => {

        return Promise.all(

          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))

        );

      })

      .then(() => {

        return self.clients.claim();

      })

  );

});

/*
=========================================================
 FETCH
=========================================================
*/

self.addEventListener("fetch", event => {

  const request = event.request;

  /*
  Solo manejamos solicitudes GET.
  */
  if(request.method !== "GET"){

    return;

  }

  const url = new URL(
    request.url
  );

  /*
  -------------------------------------------------------
  NAVEGACIÓN HTML
  -------------------------------------------------------
  */

  if(
    request.mode === "navigate"
  ){

    event.respondWith(

      fetch(request)

        .then(response => {

          /*
          Guardamos la versión más reciente.
          */

          const copy =
          response.clone();

          caches.open(
            CACHE_NAME
          ).then(cache => {

            cache.put(
              request,
              copy
            );

          });

          return response;

        })

        .catch(() => {

          /*
          Si no hay Internet,
          buscamos la página guardada.
          */

          return caches.match(
            request
          )

          .then(cached => {

            if(cached){

              return cached;

            }

            /*
            Si no existe exactamente
            la página solicitada,
            usamos index.html.
            */

            return caches.match(
              "./index.html"
            );

          });

        })

    );

    return;

  }

  /*
  -------------------------------------------------------
  ARCHIVOS LOCALES
  -------------------------------------------------------
  */

  if(
    url.origin === self.location.origin
  ){

    event.respondWith(

      caches.match(request)

        .then(cached => {

          const networkFetch =
          fetch(request)

            .then(response => {

              /*
              Actualizar caché.
              */

              if(
                response &&
                response.status === 200
              ){

                const copy =
                response.clone();

                caches.open(
                  CACHE_NAME
                ).then(cache => {

                  cache.put(
                    request,
                    copy
                  );

                });

              }

              return response;

            })

            .catch(() => {

              return cached;

            });

          /*
          Cache primero.
          */

          return cached ||
                 networkFetch;

        })

    );

    return;

  }

  /*
  -------------------------------------------------------
  RECURSOS EXTERNOS
  -------------------------------------------------------
  */

  /*
  No intentamos cachear Supabase ni APIs.
  Si hay Internet funcionan normalmente.
  Si no hay Internet, el código local
  seguirá funcionando con los datos locales.
  */

});

/*
=========================================================
 MENSAJE DESDE LA PÁGINA
=========================================================
*/

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