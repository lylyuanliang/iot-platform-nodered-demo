export function PageFrame({ title, children }) {
  return <section><header className="page-header"><p>物联感知平台</p><h1>{title}</h1></header>{children}</section>;
}

export function QueryState({ loading, error, children }) {
  if (loading) return <div className="loading-state">正在读取平台数据...</div>;
  if (error) return <div className="error-state">读取失败：{error.message}</div>;
  return children;
}
