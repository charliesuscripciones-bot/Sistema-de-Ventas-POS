const CACHE_NAME = "pos-offline-v1";

const APP_FILES = [
  "./",
  "./index.html",
  "./dashboard.html",
  "./clientes.html",
  "./cuentas.html",
  "./historial.html",
  "./inventario.html",
  "./README.md"
];

/* INSTALAR */
self.addEventListener("install", event => {

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {

        return cache.addAll(APP_FILES);

      })
      .then(() => {

        return self.skipWaiting();

      })
  );

});


/* ACTIVAR */
self.addEventListener("activate", event => {

  event.waitUntil(

    caches.keys()
      .then(cacheNames => {

        return Promise.all(

          cacheNames
            .filter(name => name !== CACHE_NAME)
            .map(name => caches.delete(name))

        );

      })
      .then(() => {

        return self.clients.claim();

      })

  );

});


/* PETICIONES */
self.addEventListener("fetch", event => {

  const request = event.request;

  /*
   * Solo manejamos peticiones GET.
   */
  if(request.method !== "GET")
    return;


  event.respondWith(

    caches.match(request)
      .then(cachedResponse => {

        /*
         * Si ya tenemos el archivo guardado,
         * lo usamos inmediatamente.
         */
        if(cachedResponse){

          return cachedResponse;

        }


        /*
         * Si no está guardado, intentamos
         * obtenerlo de Internet.
         */
        return fetch(request)
          .then(networkResponse => {

            /*
             * Guardamos una copia para futuras
             * visitas sin Internet.
             */
            if(
              networkResponse &&
              networkResponse.status === 200 &&
              networkResponse.type === "basic"
            ){

              const responseClone =
                networkResponse.clone();

              caches.open(CACHE_NAME)
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
             * Si no hay Internet y tampoco existe
             * una copia de la página solicitada,
             * regresamos index.html.
             */
            return caches.match(
              "./index.html"
            );

          });

      })

  );

});