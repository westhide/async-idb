<h1 align="center">
Async-idb
</h1>

<p align="center">
An <strong>tiny, async, easy to use, fully typed</strong> indexedDB library
<p>

## Features

- Auto wrap IDBRequest to async result, get result elegant through await

## Installation

### Using npm

```sh
npm install async-idb
```

### Using pnpm

```sh
pnpm install async-idb
```

Then new Class IndexedDB in your project:

```ts
import { IndexedDB } from 'async-idb';

const idb = new IndexedDB(
  name: string; // you indexedDB name
  schemas: [
    {
      name: /* store name */,
      // primary key options
      options: {
        autoIncrement: boolean /* is autoIncrement */,
        keyPath: string | string[] /* primary keyPath */
        },
      // indexs you want to create
      indexes: [
        { name: /* index name */, keyPath:/* index keyPatch */  }
        ...
        ],
    },
    ...
  ],
  // eventlistener to indexedDB open request
  events: {
    onsuccess() {/*  */},
    onupgradeneeded() {/*  */},
    onversionchange() {/*  */},
    onclose() {/*  */},
    onblocked() {/*  */},
    onerror() {/*  */},
  },
  preset: {
    isDropDatabaseIfExist: false,
    isAutoCreateStore: true,
    // is auto init database
    isAutoInit: true, /* if set false,
                        indexedDB will not create until you call
                        await idb.init()
                        */
  },
)
```

## Api
