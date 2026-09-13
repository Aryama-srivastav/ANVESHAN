# Backend

The backend is the first working slice of ANVESHAN. It currently provides a FastAPI API backed by SQLAlchemy models and supports:

- users and identity verification records
- cases
- documents, metadata, and immutable versions
- access grants
- classification tags
- original and external record references

## Run locally

From the `backend` directory:

```powershell
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

The default local database is `sqlite:///./anveshan.db`. Set `DATABASE_URL` to use PostgreSQL or another SQLAlchemy-supported database.

The API is available at `http://127.0.0.1:8000`; interactive documentation is at `/docs`.