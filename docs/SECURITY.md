# Security and privacy

Do not commit identity documents, statements, correspondence, account numbers, legal files, credentials or secrets.

Before hosted personal financial data:
1. make the repository private if desired;
2. enable authentication;
3. enable Supabase Row Level Security;
4. scope records to the authenticated user;
5. keep service-role credentials server-side only;
6. use provider-managed secrets, never committed `.env` files;
7. add backups and retention policy.

The seed dataset contains abstract entity labels and modeled totals only.
