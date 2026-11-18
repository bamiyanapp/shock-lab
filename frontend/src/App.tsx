import { Home } from "./pages/Home";
import { ServiceWorkerRegistration } from "./components/ServiceWorkerRegistration";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import UpdateNotifier from "./components/UpdateNotifier.jsx";

function App() {
  return (
    <ErrorBoundary>
      <ServiceWorkerRegistration />
      <UpdateNotifier />
      <Home />
    </ErrorBoundary>
  );
}

export default App;
