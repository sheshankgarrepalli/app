import pkg_resources
from fastapi import FastAPI

app = FastAPI()

@app.get("/api/debug/packages")
def list_packages():
    installed_packages = [f"{d.project_name}=={d.version}" for d in pkg_resources.working_set]
    return {"packages": sorted(installed_packages)}
