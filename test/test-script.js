const { UnsafeCode } = require('../dist/nodes/UnsafeCode.node.js');

(async () => {
  const node = new UnsafeCode();

  const items = [
    { json: { value: 1 } },
    { json: { value: 2 } },
  ];

  const context = {
    getInputData() {
      return items;
    },
    getNodeParameter(name) {
      if (name === 'mode') {
        return 'runOnceForAllItems';
      }
      if (name === 'jsCode') {
        return (
          "const path = require('path');" +
          "\nreturn items.map((item, index) => ({" +
          "\n  json: {" +
          "\n    original: item.json.value," +
          "\n    doubled: item.json.value * 2," +
          "\n    basename: path.basename(__filename)," +
          "\n    index," +
          "\n  }," +
          "\n}));"
        );
      }
      return '';
    },
    getWorkflowDataProxy() {
      return {};
    },
    getWorkflowStaticData() {
      return {};
    },
    getNode() {
      return { name: 'Unsafe Code' };
    },
    helpers: {},
    prepareOutputData(data) {
      return [data];
    },
  };

  const result = await node.execute.call(context);
  console.log('result', JSON.stringify(result));
})();
