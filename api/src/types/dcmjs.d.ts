declare module 'dcmjs' {
  const dcmjs: {
    data: {
      datasetToBuffer(dataset: Record<string, unknown>): Buffer;
    };
  };
  export default dcmjs;
}
