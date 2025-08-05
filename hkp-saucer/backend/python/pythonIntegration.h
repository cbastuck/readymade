#include <boost/python.hpp>
#include <filesystem>
#include <iostream>

class PythonIntegration
{
public:
    int start(const std::string& bundleOrPath)
    {
        if (bundleOrPath.empty())
        {
            std::cerr << "[ERROR] No bundle or path provided.\n";
            return -1;
        }

        if (!std::filesystem::exists(bundleOrPath))
        {
            std::cerr << "[ERROR] Bundle or path does not exist: " << bundleOrPath << "\n";
            return -1;
        }
        
        std::cout << "[INFO] Python script started successfully.\n";
        run(bundleOrPath);
        std::cout << "[INFO] Python script executed successfully.\n";

        return 0;
    }

    void requestPythonShutdown()
    {
        PyGILState_STATE gstate = PyGILState_Ensure();
        try
        {
            // Import the Python module where shutdown() lives
            PyObject* moduleName = PyUnicode_FromString("server");
            PyObject* module = PyImport_Import(moduleName);
            Py_DECREF(moduleName);

            if (module)
            {
                PyObject* shutdownFunc = PyObject_GetAttrString(module, "shutdown");
                if (shutdownFunc && PyCallable_Check(shutdownFunc))
                {
                    PyObject_CallObject(shutdownFunc, nullptr);
                }
                Py_XDECREF(shutdownFunc);
                Py_DECREF(module);
            }
            else
            {
                PyErr_Print();
            }
        }
        catch (...)
        {
            PyErr_Print();
        }
        PyGILState_Release(gstate);
    }

private:
    void run(const std::string& bundleOrPath)
    {
        // Initialize Python in this thread
        Py_Initialize();  // GIL is automatically ready in Python >= 3.9

        if (bundleOrPath.substr(bundleOrPath.size() - 4) != ".pyz" && !activateVenv(bundleOrPath))
        {
            std::cerr << "[ERROR] Failed to activate virtual environment.\n";
            Py_Finalize();
            return;
        }

        {
            // Always acquire GIL before Python calls
            PyGILState_STATE gstate = PyGILState_Ensure();

            try
            {
                std::string script =
                    "import runpy; runpy.run_path(r'" + bundleOrPath + "', run_name='__main__')";
                if (PyRun_SimpleString(script.c_str()) != 0)
                {
                    PyErr_Print();
                }
            }
            catch (boost::python::error_already_set&)
            {
                PyErr_Print();
            }

            PyGILState_Release(gstate);
        }

        Py_Finalize();
    }

    bool activateVenv(const std::string& projectPath)
    {
        namespace fs = std::filesystem;
        fs::path venvPath = fs::path(projectPath) / ".venv";
        if (!fs::exists(venvPath))
        {
            std::cerr << "[ERROR] No .venv found at: " << venvPath << "\n";
            return false;
        }

        std::string pyVersion =
            std::to_string(PY_MAJOR_VERSION) + "." + std::to_string(PY_MINOR_VERSION);

#ifdef _WIN32
        fs::path sitePackages = venvPath / "Lib" / "site-packages";
#else
        fs::path sitePackages = venvPath / "lib" / ("python" + pyVersion) / "site-packages";
#endif

        if (!fs::exists(sitePackages))
        {
            std::cerr << "[ERROR] site-packages not found at: " << sitePackages << "\n";
            return false;
        }

        // Acquire GIL before modifying Python state
        PyGILState_STATE gstate = PyGILState_Ensure();

        std::string activateCode =
            "import sys, os\n"
            "site_packages = r'" + sitePackages.string() + "'\n"
            "venv_path = r'" + venvPath.string() + "'\n"
            "sys.path.insert(0, site_packages)\n"
            "sys.prefix = venv_path\n"
            "sys.exec_prefix = venv_path\n";

        bool success = (PyRun_SimpleString(activateCode.c_str()) == 0);
        if (success)
        {
            std::cout << "[INFO] Activated venv: " << venvPath << "\n";
        }
        else
        {
            PyErr_Print();
        }

        PyGILState_Release(gstate);
        return success;
    }
};
  