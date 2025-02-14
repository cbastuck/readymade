import { useState } from "react";

import "./App.css";

function App() {
  const [count, setCount] = useState(0);

  const onClick = async () => {
    const result = await (window as any).saucer.exposed.add_ten(count);
    setCount(result);
  };
  return (
    <>
      <h1>HOOKITAPP</h1>
      <div className="card">
        <button onClick={onClick}>The Value ist: {count}</button>
      </div>
    </>
  );
}

export default App;
