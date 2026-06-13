// Re-export of react-router hooks so sibling packages (e.g. meander/frontend,
// which alias `hkp-frontend/src` but don't depend on react-router-dom directly)
// use *this* package's react-router instance — i.e. the same Router context that
// hkp-frontend's <App> mounts. Importing react-router-dom separately would yield
// a different context and break the hooks at runtime.
export { useLocation, useNavigate } from "react-router-dom";
