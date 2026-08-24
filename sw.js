const CACHE_NAME = "sistema-pos-v1";

const APP_FILES = [
  "./",
  "./index.html",
  "./dashboard.html",
  "./clientes.html",
  "./cuentas.html",
  "./historial.html",
  "./inventario.html"
];

self.addEventListener("install", event => {

  event.waitUntil(

    caches.open(CACHE_NAME)
      .then(cache => {

        return cache.addAll(APP_FILES);

      })

  );

  self.skipWaiting();

});


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

  );

  self.clients.claim();

});


self.addEventListener("fetch", event => {

  const request = event.request;

  if(request.method !== "GET")
    return;


  const url = new URL(
    request.url
  );


  /*
   * Supabase debe seguir funcionando
   * normalmente cuando hay Internet.
   *
   * No intentamos guardar respuestas
   * de Supabase en este primer paso.
   */

  if(
    url.hostname.includes(
      "supabase.co"
    )
  ){

    return;

  }


  event.respondWith(

    caches.match(request)
      .then(cachedResponse => {

        if(cachedResponse){

          return cachedResponse;

        }


        return fetch(request)
          .then(response => {

            if(
              !response ||
              response.status !== 200 ||
              response.type === "opaque"
            ){

              return response;

            }


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

            });


            return response;

          })
          .catch(() => {

            /*
             * Si no hay Internet y la página
             * no estaba previamente almacenada,
             * intentamos regresar index.html.
             */

            return caches.match(
              "./index.html"
            );

          });

      })

  );

});