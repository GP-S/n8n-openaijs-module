# n8n‑nodes‑openai‑script

An external node for [n8n](https://n8n.io/) that lets you run arbitrary asynchronous JavaScript with access to the [OpenAI TypeScript SDK](https://www.npmjs.com/package/openai). The node executes your script inside a `new Function` context and exposes a pre‑configured OpenAI client (available as `openai` or `client`), the incoming items, and the Node.js `require` function. Whatever value you `return` from your script becomes the output of the node.

## Features

* **Execute custom code** – Write any asynchronous JavaScript and use `await` without boilerplate.
* **OpenAI SDK** – A fully initialised OpenAI client is injected into your script (accessible via `openai` or `client`), allowing you to call any OpenAI API supported by version 5.11.0.
* **Access input items** – The `input` variable contains the array of items returned by `this.getInputData()`.
* **Use `require`** – Import additional Node.js packages available in your n8n instance using the familiar `require()` syntax. The module bundles popular helpers like `langchain` out of the box.
* **Flexible execution** – Choose between running your script once for all items or once per incoming item.

## Installation

You need a working self‑hosted n8n installation (version ≥ 1.97) running on Node.js 18 or later. The steps below describe how to build and install this module.

### 1. Clone and build

Clone the repository and install its dependencies. The build script compiles the TypeScript source into the `dist` directory.

```bash
git clone https://github.com/your‑username/n8n-nodes-openai-script.git
cd n8n-nodes-openai-script
npm install
npm run build
```

### 2. Install into n8n (local installation)

If you are running n8n via `npm` on your machine, navigate to your n8n configuration folder (by default this is `~/.n8n`) and install the module from your local checkout. n8n will automatically detect and load the custom node on the next start.

```bash
# change into your n8n user directory
cd ~/.n8n
# install the built module
npm install /absolute/path/to/n8n-nodes-openai-script

# (re)start n8n
npx n8n start
```

The node will appear in the editor under the **Custom** category, labelled **OpenAI Script**.

### 3. Using with Docker

For Docker deployments you can either mount the compiled module into the container or bake it into a custom image. Two common approaches are shown below.

#### Mount the module at runtime

First build the project locally as described above so that the `dist` folder exists. Then mount the module into your container and set the `N8N_CUSTOM_EXTENSIONS` environment variable so n8n picks up your custom code.

```yaml
services:
  n8n:
    image: n8nio/n8n:latest
    ports:
      - "5678:5678"
    volumes:
      # persist n8n data
      - ./n8n_data:/home/node/.n8n
      # mount the entire module so that package.json and dist are available
      - ./n8n-nodes-openai-script:/home/node/.n8n/custom/nodes/n8n-nodes-openai-script
    environment:
      - N8N_CUSTOM_EXTENSIONS=/home/node/.n8n/custom
```

After starting the container (`docker compose up`), the OpenAI Script node will appear in the editor.

#### Build a custom Docker image

Another option is to bake the module into a custom Docker image. Create a `Dockerfile` like the following:

```Dockerfile
FROM n8nio/n8n:latest

# Copy the custom node sources into the container
COPY ./n8n-nodes-openai-script /opt/n8n-nodes-openai-script

# Install the custom node inside the n8n installation
RUN cd /usr/local/lib/node_modules/n8n \
  && npm install /opt/n8n-nodes-openai-script

```

Then build and run:

```bash
docker build -t n8n-custom .
docker run -it --rm -p 5678:5678 n8n-custom
```

## Usage

After installation, search for **OpenAI Script** in the n8n editor and drag the node into your workflow. The node exposes two parameters:

* **API Key** – Your OpenAI API key. This key is used to create the client. It is not persisted anywhere by the node.
* **Script** – A text area where you can write asynchronous JavaScript. You have access to the following variables:
  * `openai`/`client` – An instance of the OpenAI SDK initialised with your API key.
  * `input` – The input items array returned by `this.getInputData()`.
  * `item` – In per-item mode, the current item being processed.
  * `require` – Node.js `require()` function to import additional packages installed in the environment.

The value you `return` from your script becomes the node’s output. It should be structured as an array of items compatible with n8n’s data format (`INodeExecutionData[]`), or any structure accepted by `this.prepareOutputData()`.

### Example

Here’s a simple example that uses the Chat Completion API to answer a question contained in the first input item’s JSON:

```js
// Use the OpenAI Chat Completion endpoint
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: input[0].json.question },
  ],
});

// Return the assistant’s reply as a new item
return [
  {
    json: {
      answer: response.choices[0].message.content,
    },
  },
];
```

## Compatibility

This module targets Node.js 18 and later and requires n8n v1.97 or newer. It depends on the [`openai`](https://www.npmjs.com/package/openai) package version 5.11.0.

## Security considerations

The user script is executed with full access to Node.js APIs via `require` and the OpenAI client. It is **not sandboxed**. Only use this node in trusted environments (for example, your own infrastructure) and avoid running untrusted code.

## License

MIT