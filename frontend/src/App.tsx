import { Home } from "./pages/Home";
import { ServiceWorkerRegistration } from "./components/ServiceWorkerRegistration";
import UpdateNotifier from "./components/UpdateNotifier.jsx";

function App() {
  return (
    <>
      <ServiceWorkerRegistration />
      <UpdateNotifier />
      <Home />
    </>
  );
}

export default App;
