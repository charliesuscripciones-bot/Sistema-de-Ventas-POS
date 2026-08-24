"use strict";

/*
=========================================================
 SISTEMA DE VENTAS POS
 SERVICE WORKER — OFFLINE / ONLINE
=========================================================

 v5

 • Evita páginas HTML antiguas.
 • ONLINE  → obtiene la versión actual.
 • OFFLINE → utiliza la versión almacenada.
 • Dashboard disponible offline.
 • POS disponible offline.
 • Clientes disponible offline.
 • Cuentas disponible offline.
 • Historial disponible offline.
 • Inventario disponible offline.
 • Supabase JS disponible offline.
 • Elimina cachés anteriores.
=========================================================
*/


/* ========================================================
   VERSIÓN DEL CACHÉ
======================================================== */

const CACHE_VERSION =
  "pos-offline-v5";


const APP_CACHE =
  CACHE_VERSION + "-app";


/* ========================================================
   PÁGINAS PRINCIPALES
======================================================== */

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


/* ========================================================
   RECURSOS EXTERNOS
======================================================== */

const EXTERNAL_RESOURCES = [

  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"

];


/* ========================================================
   INSTALL
======================================================== */

self.addEventListener(
  "install",
  event => {

    event.waitUntil(

      (async () => {

        const cache =
          await caches.open(
            APP_CACHE
          );


        /* ==================================================
           GUARDAR PÁGINAS
        ================================================== */

        for(
          const resource
          of APP_SHELL
        ){

          try{

            const response =
              await fetch(
                resource,
                {
                  cache:"no-store"
                }
              );


            if(
              response.ok
            ){

              await cache.put(
                resource,
                response.clone()
              );

            }

          }

          catch(error){

            console.warn(
              "[SW] No se pudo precargar:",
              resource,
              error
            );

          }

        }


        /* ==================================================
           GUARDAR SUPABASE JS
        ================================================== */

        for(
          const resource
          of EXTERNAL_RESOURCES
        ){

          try{

            const response =
              await fetch(
                resource,
                {
                  cache:"no-store"
                }
              );


            if(
              response.ok
            ){

              await cache.put(
                resource,
                response.clone()
              );

            }

          }

          catch(error){

            console.warn(
              "[SW] No se pudo guardar recurso externo:",
              resource,
              error
            );

          }

        }


        /* ==================================================
           ACTIVACIÓN INMEDIATA
        ================================================== */

        await self.skipWaiting();

      })()

    );

  }
);


/* ========================================================
   ACTIVATE
======================================================== */

self.addEventListener(
  "activate",
  event => {

    event.waitUntil(

      (async () => {

        const cacheNames =
          await caches.keys();


        /*
        ----------------------------------------------------
        BORRAR CACHÉS ANTERIORES
        ----------------------------------------------------
        */

        await Promise.all(

          cacheNames
            .filter(
              cacheName =>
                cacheName !== APP_CACHE
            )
            .map(
              cacheName =>
                caches.delete(
                  cacheName
                )
            )

        );


        /*
        ----------------------------------------------------
        TOMAR CONTROL DE LAS PÁGINAS
        ----------------------------------------------------
        */

        await self.clients.claim();


        console.log(
          "[SW] Activado:",
          CACHE_VERSION
        );

      })()

    );

  }
);


/* ========================================================
   FETCH
======================================================== */

self.addEventListener(
  "fetch",
  event => {

    const request =
      event.request;


    /*
    --------------------------------------------------------
    Solo GET
    --------------------------------------------------------
    */

    if(
      request.method !==
      "GET"
    ){

      return;

    }


    const url =
      new URL(
        request.url
      );


    /* ======================================================
       SUPABASE JS
       CACHE FIRST
    ====================================================== */

    if(
      url.origin ===
      "https://cdn.jsdelivr.net"
    ){

      event.respondWith(

        cacheFirst(
          request
        )

      );

      return;

    }


    /* ======================================================
       ARCHIVOS DEL POS
    ====================================================== */

    if(
      url.origin ===
      self.location.origin
    ){

      /*
      ------------------------------------------------------
      NAVEGACIÓN HTML

      ONLINE:
      siempre intenta obtener la versión nueva.

      OFFLINE:
      utiliza caché.

      Esto evita que el POS quede atrapado en
      un index.html antiguo.
      ------------------------------------------------------
      */

      if(
        request.mode ===
        "navigate"
      ){

        event.respondWith(

          navigationHandler(
            request
          )

        );

        return;

      }


      /*
      ------------------------------------------------------
      CSS / JS / IMÁGENES / MANIFEST
      ------------------------------------------------------
      */

      event.respondWith(

        cacheFirst(
          request
        )

      );

      return;

    }

  }
);


/* ========================================================
   CACHE FIRST
======================================================== */

async function cacheFirst(
  request
){

  /*
  ----------------------------------------------------------
  BUSCAR PRIMERO EN CACHÉ
  ----------------------------------------------------------
  */

  const cached =
    await caches.match(
      request
    );


  if(
    cached
  ){

    return cached;

  }


  /*
  ----------------------------------------------------------
  SI NO EXISTE, BUSCAR EN INTERNET
  ----------------------------------------------------------
  */

  try{

    const response =
      await fetch(
        request
      );


    if(
      response &&
      response.ok
    ){

      const cache =
        await caches.open(
          APP_CACHE
        );


      await cache.put(
        request,
        response.clone()
      );

    }


    return response;

  }

  catch(error){

    console.warn(
      "[SW] Recurso no disponible:",
      request.url
    );


    return new Response(
      "Recurso no disponible offline",
      {
        status:503,
        statusText:"Offline"
      }
    );

  }

}


/* ========================================================
   NAVEGACIÓN NETWORK FIRST
======================================================== */

async function navigationHandler(
  request
){

  /*
  ========================================================
   1. INTENTAR INTERNET
  ========================================================
  */

  try{

    const response =
      await fetch(
        request,
        {
          cache:"no-store"
        }
      );


    if(
      response &&
      response.ok
    ){

      const cache =
        await caches.open(
          APP_CACHE
        );


      /*
      ------------------------------------------------------
      Guardar la URL exacta
      ------------------------------------------------------
      */

      await cache.put(
        request,
        response.clone()
      );


      /*
      ------------------------------------------------------
      Guardar también el archivo por nombre
      ------------------------------------------------------
      */

      const url =
        new URL(
          request.url
        );


      const pathname =
        url.pathname;


      const filename =
        pathname
          .split("/")
          .pop();


      if(
        filename
      ){

        try{

          await cache.put(
            "./" + filename,
            response.clone()
          );

        }

        catch(error){

          console.warn(
            "[SW] No se pudo guardar copia relativa:",
            filename
          );

        }

      }


      return response;

    }

  }

  catch(error){

    console.log(
      "[SW] Sin Internet. Buscando página en caché."
    );

  }


  /*
  ========================================================
   2. OFFLINE — URL EXACTA
  ========================================================
  */

  const exactCached =
    await caches.match(
      request
    );


  if(
    exactCached
  ){

    return exactCached;

  }


  /*
  ========================================================
   3. OFFLINE — BUSCAR POR NOMBRE
  ========================================================
  */

  const url =
    new URL(
      request.url
    );


  const pathname =
    url.pathname;


  const filename =
    pathname
      .split("/")
      .pop();


  if(
    filename
  ){

    const filenameCached =
      await caches.match(
        "./" + filename
      );


    if(
      filenameCached
    ){

      return filenameCached;

    }

  }


  /*
  ========================================================
   4. DASHBOARD OFFLINE
  ========================================================
  */

  if(
    pathname
      .toLowerCase()
      .includes(
        "dashboard"
      )
  ){

    const dashboardCached =
      await caches.match(
        "./dashboard.html"
      );


    if(
      dashboardCached
    ){

      return dashboardCached;

    }

  }


  /*
  ========================================================
   5. POS PRINCIPAL OFFLINE
  ========================================================
  */

  const offlineHome =
    await caches.match(
      "./index.html"
    );


  if(
    offlineHome
  ){

    return offlineHome;

  }


  /*
  ========================================================
   6. ÚLTIMO RECURSO
  ========================================================
  */

  return new Response(

`<!DOCTYPE html>

<html lang="es">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
>

<title>Sistema de Ventas POS</title>

<style>

body{
  font-family:
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;

  background:#f5f5f5;

  padding:30px;

  text-align:center;

  color:#111827;
}

.card{
  background:white;

  border-radius:18px;

  padding:30px;

  max-width:500px;

  margin:40px auto;
}

</style>

</head>

<body>

<div class="card">

<h1>
📱 Sistema de Ventas POS
</h1>

<p>
La aplicación está funcionando sin conexión.
</p>

<p>
Necesitas abrir la aplicación al menos una vez con Internet para guardar sus páginas en el dispositivo.
</p>

</div>

</body>

</html>`,

    {
      status:200,

      headers:{
        "Content-Type":
          "text/html; charset=utf-8"
      }
    }

  );

}


/* ========================================================
   MENSAJES
======================================================== */

self.addEventListener(
  "message",
  event => {

    if(
      event.data ===
      "SKIP_WAITING"
    ){

      self.skipWaiting();

    }

  }
);


/* ========================================================
   DEBUG
======================================================== */

console.log(
  "[SW] Sistema POS Offline cargado:",
  CACHE_VERSION
);