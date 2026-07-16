import { useApi } from "../api/client.js";
import { DataTable } from "../components/DataTable.jsx";
import { PageFrame, QueryState } from "../components/PageFrame.jsx";

export default function ProductsThingModel() {
  const products = useApi("/api/products");
  const productKey = products.data?.[0]?.product_key;
  const model = useApi(productKey ? `/api/products/${productKey}/thing-model` : "/api/products/temperature-sensor/thing-model");
  return <PageFrame title="产品与物模型"><QueryState loading={products.loading} error={products.error}><h2>产品</h2><DataTable rows={products.data} /></QueryState><QueryState loading={model.loading} error={model.error}><h2>物模型</h2><DataTable rows={model.data} columns={["model_type", "identifier", "name", "data_type", "unit", "description"]} /></QueryState></PageFrame>;
}
