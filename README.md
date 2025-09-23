# n8n-nodes-unsafe-code

A community node for [n8n](https://n8n.io/) that mirrors the official **Code** node while removing the sandbox. It executes your JavaScript directly in Node.js so you can `require()` local dependencies, dynamically `import()` packages, and leverage any module installed in your n8n instance without restrictions. The node keeps the familiar Code node UX — the same parameters, helpers, and execution modes — but is intentionally unsafe and should only be used in trusted environments.

> ⚠️ **Security warning:** this node runs arbitrary JavaScript with full access to your host environment. Only install it on instances you fully control and never execute untrusted code.

## Features

- **Same interface as the Code node** – Run once for all items or once per item using the standard editor with `$` auto-complete and helper variables.
- **No sandbox** – Access the native `require` function, built-in Node.js modules, dynamic `import()`, and any community packages already available on your n8n host.
- **Workflow helpers** – `$input`, `$json`, `$getNodeParameter`, HTTP helper functions, and the rest of the data proxy behave just like in the official node.
- **Return n8n items** – Output data using the regular n8n item structure with automatic validation similar to the core node.

## Installation

The project targets Node.js 18+ and n8n 1.97+. Clone the repo, build the TypeScript sources, and install the compiled package in your n8n instance.

### 1. Clone and build

```bash
git clone https://github.com/your-username/n8n-nodes-unsafe-code.git
cd n8n-nodes-unsafe-code
npm install
npm run build
```

### 2. Install into n8n (local installation)

```bash
cd ~/.n8n
npm install /absolute/path/to/n8n-nodes-unsafe-code
npm run patch:ui
npx n8n start
```

The **Unsafe Code** node will appear under **Custom** in the node picker.

### 3. Use with Docker

If you run n8n in Docker, either mount the built module at runtime or bake it into a custom image.

**Mount at runtime**

```yaml
services:
  n8n:
    image: n8nio/n8n:latest
    ports:
      - "5678:5678"
    volumes:
      - ./n8n_data:/home/node/.n8n
      - ./n8n-nodes-unsafe-code:/home/node/.n8n/custom/nodes/n8n-nodes-unsafe-code
    environment:
      - N8N_CUSTOM_EXTENSIONS=/home/node/.n8n/custom
```

**Custom image**

```Dockerfile
FROM n8nio/n8n:latest

COPY ./n8n-nodes-unsafe-code /opt/n8n-nodes-unsafe-code
RUN cd /usr/local/lib/node_modules/n8n \
  && npm install /opt/n8n-nodes-unsafe-code \
  && npm run patch:ui
```

> ℹ️ **Inline editor patch:** The installation runs a small script that adds `n8n-nodes-unsafe-code.unsafeCode` to the front-end allow list used by n8n’s inline Code node editor. If you still see a read-only field, run `npm run patch:ui` inside your n8n installation directory to re-apply the patch after upgrades.

## Usage

1. Add the **Unsafe Code** node to your workflow.
2. Choose whether to run once for all incoming items or for each item individually.
3. Write asynchronous JavaScript. You can access:
   - `$input`, `$json`, `$node`, `$parameter`, and other workflow helpers.
   - `helpers` from the execution context, including `httpRequestWithAuthentication`.
   - Native Node.js globals such as `require`, `process`, `Buffer`, timers, and `fetch`.
   - `module.exports` or a direct `return` value to pass data to subsequent nodes.

Return a single item (object with a `json` property) or an array of items. Validation mirrors the official Code node and throws descriptive errors when the structure is invalid.

```js
const fs = require('fs');
const path = require('path');

const notes = fs.readFileSync('/data/notes.txt', 'utf8');
return items.map((item, index) => ({
  json: {
    ...item.json,
    lineNumber: index + 1,
    notes,
    filename: path.basename(__filename),
  },
}));
```

## Development

- `npm run build` – Compile TypeScript, copy the node description, and bundle the icon into `dist/`.
- `npm test` – Build the project and execute a minimal smoke test that ensures the node can `require()` core modules and emit valid n8n items.

## License

MIT
