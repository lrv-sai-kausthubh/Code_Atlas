You are a senior software architect and security engineer helping design and implement a production-grade Role-Based Access Control (RBAC) and fine-grained code visibility system for CodeAtlas.

==================================================
1. PRODUCT CONTEXT
==================================================

CodeAtlas is an interactive codebase visualization and code intelligence platform.

It analyzes software repositories and creates a graph representing:

- Files
- Folders
- Modules
- Imports
- Dependencies
- Relationships
- Eventually functions/classes/call graphs
- Architecture and dependency information


==================================================
2. FEATURE TO IMPLEMENT
==================================================

We need to introduce enterprise-grade access control.

A repository may contain hundreds or thousands of files.

Different users may have different permissions.

Example:

Person A:
- Can access 50 files

Person B:
- Can access 100 files

Person C:
- Can access 250 files

However, we do NOT want the graph to simply hide files that a user cannot access.

Why?

Because hiding inaccessible files makes architecture visualization inaccurate.

Example:

Person A can access:

frontend/
auth/
dashboard/

Person B can access:

frontend/
auth/
dashboard/
payments/
billing/

There may be a dependency:

checkout.ts
    ↓
payment_service.py
    ↓
payment_database.py

Person A may not have permission to read payment_service.py.

However, Person A should still be able to understand that:

checkout.ts
    ↓
payment_service.py

exists.

The inaccessible node should appear in the graph, but its source code must not be exposed.

Therefore CodeAtlas must separate:

1. Metadata visibility
2. Graph relationship visibility
3. Source-code/content access
4. Administrative access

==================================================
3. CORE SECURITY PRINCIPLE
==================================================

NEVER treat the frontend as a security boundary.

The frontend may hide UI elements for usability, but all authorization must be enforced by the backend.

Every sensitive operation must perform server-side authorization.

Examples:

GET file metadata
GET file content
GET code snippet
GET AST
GET function source
GET dependency information
GET repository statistics
GET graph
GET AI context
DOWNLOAD file
EXPORT repository
SEARCH source code
VIEW git history
VIEW commit diff

must independently respect authorization rules.

A malicious user must not be able to bypass permissions simply by:

- Editing JavaScript
- Calling an API manually
- Using Bruno/Postman
- Modifying request parameters
- Changing file IDs
- Changing URLs
- Calling hidden endpoints
- Inspecting network requests
- Manipulating React state

==================================================
4. TWO DISTINCT PERMISSION DIMENSIONS
==================================================

Design the system around at least two major permission dimensions.

------------------------------------------
A. METADATA / GRAPH VISIBILITY
------------------------------------------

Controls whether the user can know that an entity exists.

Examples:

User may see:

payment_service.py
billing/
database/payment_repository.py

and see relationships such as:

checkout.ts
    ↓
payment_service.py

without seeing the source code.

Metadata may include:

- File name
- Folder name
- File path
- File type
- Language
- File size
- Number of dependencies
- Dependency relationships
- Node position
- Basic graph statistics

Metadata visibility itself must be configurable because filenames and paths can also contain sensitive information.

------------------------------------------
B. CONTENT ACCESS
------------------------------------------

Controls whether the user may see the actual contents.

Examples:

User A:

payment_service.py
Metadata: ALLOWED
Graph: ALLOWED
Source code: DENIED

User B:

payment_service.py
Metadata: ALLOWED
Graph: ALLOWED
Source code: ALLOWED

==================================================
5. ACCESS LEVELS
==================================================

Design permissions so they can exist at multiple levels.

Recommended hierarchy:

Organization
    ↓
Project / Repository
    ↓
Folder
    ↓
File
    ↓
Function / Class / Symbol

The initial implementation may enforce permissions at repository, folder, and file level.

The architecture must allow future function-level permissions.

==================================================
6. RECOMMENDED ROLES
==================================================

Create configurable roles rather than hardcoding everything around job titles.

Initial system roles may include:

------------------------------------------
SUPER ADMIN
------------------------------------------

Can:

- Manage organization
- Manage repositories
- Manage users
- Manage teams
- Create roles
- Modify permissions
- View audit logs
- Manage security settings
- Access all repository content

------------------------------------------
ORGANIZATION ADMIN
------------------------------------------

Can:

- Manage users
- Manage teams
- Manage repositories
- Assign repository administrators
- Configure access policies

Cannot automatically read repository code unless explicitly granted repository content access.

IMPORTANT:

Administrative permission and source-code permission should be separate concepts.

------------------------------------------
REPOSITORY ADMIN
------------------------------------------

Can:

- Manage repository permissions
- Manage teams
- Configure file/folder access
- View repository analytics
- Manage graph settings

------------------------------------------
ARCHITECT
------------------------------------------

Can:

- View repository graph
- View metadata
- View architecture analytics
- View allowed source code
- Perform architecture analysis
- Potentially export architecture reports

------------------------------------------
DEVELOPER
------------------------------------------

Can:

- View graph
- View metadata
- Read permitted source files
- Search permitted source
- Inspect permitted files

------------------------------------------
VIEWER
------------------------------------------

Can:

- View permitted graph
- View metadata
- View permitted architecture information

May not edit or access source code unless explicitly granted.

------------------------------------------
CUSTOM ROLE
------------------------------------------

Administrators should eventually be able to create custom roles.

Example:

Security Analyst:
- Graph: YES
- Metadata: YES
- Source: NO
- Audit Logs: YES
- Export: NO

==================================================
7. FINE-GRAINED PERMISSIONS
==================================================

Do not make authorization a single boolean.

Use explicit permissions.

Example permission model:

repository.view
repository.manage

graph.view

metadata.view
metadata.search

file.view
file.download
file.edit

source.view
source.search

function.view

git.history.view
git.diff.view

ai.query
ai.source_context

export.graph
export.source

audit.view

permissions.manage

users.manage

teams.manage

==================================================
8. IMPORTANT: AI PERMISSIONS
==================================================

AI access must obey exactly the same authorization rules.

This is critical.

Example:

Person A cannot read:

payment_service.py

Therefore Person A's AI assistant must NOT be able to answer:

"Show me the implementation of payment_service.py"

The AI must not receive the contents of that file in its context.

It must also not indirectly leak the information.

For example:

User:
"How does the payment service validate credit cards?"

If the user does not have source access:

AI should respond with something like:

"You can see that checkout.ts depends on payment_service.py, but you do not have permission to inspect the implementation of that module."

The AI must never receive unauthorized source code and then be instructed to hide it.

Authorization must happen BEFORE retrieval/context construction.

we will implement the ai feature later you can ignore it for now

==================================================
9. GRAPH BEHAVIOR
==================================================

The graph should distinguish between:

ACCESSIBLE NODE

and

METADATA-ONLY NODE

and optionally:

HIDDEN NODE

Example:

User A:

checkout.ts
    ↓
payment_service.py
    ↓
payment_database.py

If only checkout.ts is accessible:

checkout.ts
    ↓
[ payment_service.py ]
    ↓
[ payment_database.py ]

The inaccessible nodes can have:

- Different visual styling
- Lock icon
- "Restricted" label
- Reduced metadata
- No source preview

But the graph relationship can remain visible.

Clicking payment_service.py should NOT reveal source code.

Instead:

------------------------------------------
ACCESS RESTRICTED

You can see this module because it participates
in the architecture graph.

You do not have permission to view its source code.

Contact the repository administrator if you need access.

[Request Access]
------------------------------------------

==================================================
10. ACCESSIBLE FILE INSPECTOR
==================================================

For authorized files:

Show:

- File name
- Full path
- Language
- Size
- Last modified
- Git information
- Source code
- Imports
- Exports
- Functions
- Classes
- Dependencies
- Dependents
- Complexity metrics

Example:

auth.ts

ACCESS:
Source Code: Allowed

Imports:
jwt.ts
config.ts

Imported By:
login.ts
session.ts

==================================================
11. RESTRICTED FILE INSPECTOR
==================================================

For unauthorized files:

Show only information allowed by metadata policy.

Example:

payment_service.py

ACCESS RESTRICTED

Node Type:
File

Language:
Python

Path:
services/payment_service.py

Relationships:
Imported by:
checkout.ts

Imports:
3 modules

Source:
LOCKED

[Request Access]

DO NOT show:

- Source code
- Code snippets
- Function bodies
- Secret values
- Environment variables
- API keys
- Sensitive comments
- Unauthorized AST details

==================================================
12. CODE SNIPPETS
==================================================

If a file is accessible:

Allow:

- Full file
- Selected lines
- Function
- Class
- Symbol

If a file is inaccessible:

Do not return any source bytes.

Do not return snippets.

Do not return partial lines.

Do not assume that showing "just 5 lines" is safe.

Source authorization must be binary or explicitly policy-controlled.

==================================================
13. SEARCH SECURITY
==================================================

Search is a major security boundary.

A user should not be able to search for:

"stripe_secret"
"password"
"payment validation"
"internal API"

and receive results from files they cannot access.

Search must only index/query content the user is authorized to access.

Potential architecture:

Repository Index
    ↓
Authorization Filter
    ↓
User-accessible documents
    ↓
Search

For metadata search, metadata visibility rules apply.

For source search, source permissions apply.

==================================================
14. GRAPH SEARCH
==================================================

When searching:

"payment_service.py"

If metadata access is allowed:

Show:

payment_service.py
LOCKED

If metadata access is denied:

Do not reveal it.

This distinction must be configurable.

==================================================
15. ACCESS REQUEST SYSTEM
==================================================

If a user attempts to open a restricted resource:

Show:

ACCESS RESTRICTED

You don't currently have permission to view this resource.

[Request Access]

The request should contain:

- User
- Repository
- Resource
- Requested permission
- Reason
- Timestamp

Example:

User:
Alice

Resource:
services/payment_service.py

Requested:
source.view

Reason:
"Need to debug checkout integration."

Administrator receives the request.

Admin can:

Approve
Reject
Approve temporarily
Approve permanently

==================================================
16. TEMPORARY ACCESS
==================================================

Support time-limited permissions.

Example:

Developer receives access to:

payment_service.py

for:

24 hours

or:

7 days

After expiration:

source access automatically disappears.

The graph relationship remains visible if metadata permission remains.

==================================================
17. TEAM-BASED ACCESS
==================================================

Do not assign every permission individually.

Support teams/groups.

Example:

Frontend Team

Backend Team

Payments Team

Security Team

Architecture Team

DevOps Team

Permissions can be assigned to teams.

User:

Alice

Teams:

Frontend Team
Architecture Team

Effective permissions are calculated from team memberships.

==================================================
18. PERMISSION INHERITANCE
==================================================

Support inheritance.

Example:

backend/
    services/
        payment/
            payment.py

If user receives:

backend/

then permission may inherit to:

services/
payment/
payment.py

Administrators should be able to override inheritance.

Example:

backend/
    ALLOW

backend/secrets/
    DENY

Need a clear policy for conflicts.

Recommended:

Explicit DENY takes precedence over inherited ALLOW.

However, avoid designing ambiguous rules.

Every effective permission should be explainable.

==================================================
19. PERMISSION EXPLANATION
==================================================

When debugging authorization, administrators should be able to ask:

"Why can Alice access this file?"

System returns:

Alice
↓
Member of Backend Team
↓
Backend Team
↓
Repository permission:
source.view
↓
Inherited from:
backend/

ALLOW

Or:

"Why can't Alice access payment.py?"

Alice
↓
Backend Team
↓
backend/
ALLOW
↓
payment/
DENY
↓
Explicit DENY overrides inherited permission

This is extremely useful for enterprise administrators.

==================================================
20. ADMIN PORTAL
==================================================

Create a dedicated administration interface.

Sections:

------------------------------------------
Dashboard
------------------------------------------

Show:

Users
Teams
Repositories
Permission coverage
Access requests
Recent security events

------------------------------------------
Users
------------------------------------------

Admin can:

- Add user
- Disable user
- Remove user
- Assign roles
- Add to teams
- View effective permissions

------------------------------------------
Teams
------------------------------------------

Admin can:

- Create team
- Add/remove members
- Assign repository permissions
- Assign folder permissions

------------------------------------------
Repositories
------------------------------------------

Admin can:

- Connect repository
- Configure visibility
- Configure default permissions
- Assign repository admins

------------------------------------------
File / Folder Permissions
------------------------------------------

Tree view:

repository/
├── frontend/        ALLOW
├── backend/         ALLOW
├── payments/        RESTRICTED
└── secrets/         DENY

Admin can select any folder/file and configure:

Metadata
Graph
Source
Download
AI context

------------------------------------------
Access Requests
------------------------------------------

Show:

User
Resource
Requested permission
Reason
Date
Status

Actions:

Approve
Reject
Temporary approval

------------------------------------------
Audit Logs
------------------------------------------

Show:

Who
What
Resource
Action
Timestamp
IP/device metadata where appropriate
Result

Examples:

Alice viewed auth.ts
Bob attempted to access payment.py
Admin granted Charlie source.view
Alice requested access to billing/

==================================================
21. AUDIT LOGGING
==================================================

Every security-sensitive event should be auditable.

Log:

- Login
- Logout
- Failed login
- Permission changes
- Role changes
- Team changes
- File access
- Restricted access attempts
- Access requests
- Approvals
- Rejections
- Downloads
- Exports
- AI queries involving repository data
- GitHub connection changes

Never log raw source code or secrets.

Audit logs themselves must be protected.

==================================================
22. SECURITY EVENTS
==================================================

Detect suspicious behavior.

Example:

User attempts to access:

100 restricted files

within 30 seconds.

System can generate:

SECURITY ALERT

Potential unauthorized enumeration detected.

Possible signals:

- Excessive denied requests
- Rapid file enumeration
- Repeated restricted searches
- Unusual download behavior
- Excessive API requests

This can become a future enterprise security feature.

==================================================
23. API SECURITY
==================================================

Every sensitive FastAPI endpoint must perform authorization.

Example conceptual middleware/dependency:

authenticate_user()
        ↓
identify_repository()
        ↓
identify_resource()
        ↓
check_permission()
        ↓
perform_operation()

Do NOT implement authorization only in React.

Example insecure approach:

Frontend:
if (!canViewFile) hide code

This is insufficient.

Correct:

Frontend:
hide UI

Backend:
check permission

Backend:
return authorized data only

==================================================
24. API RESPONSE DESIGN
==================================================

Never return unauthorized source content and expect the frontend to hide it.

For graph nodes, return an explicit access state.

Example:

{
    "id": "file-123",
    "name": "payment_service.py",
    "type": "file",
    "path": "services/payment_service.py",
    "access": {
        "metadata": true,
        "graph": true,
        "source": false,
        "download": false,
        "ai_context": false
    }
}

For an authorized file:

{
    "id": "file-456",
    "name": "checkout.ts",
    "access": {
        "metadata": true,
        "graph": true,
        "source": true,
        "download": true,
        "ai_context": true
    }
}

Do not return unnecessary sensitive permission information.

==================================================
25. NEO4J DATA MODEL
==================================================

Design the graph so authorization can be represented separately from code relationships.

Possible conceptual entities:

(:Organization)

(:User)

(:Team)

(:Repository)

(:Folder)

(:File)

(:Function)

(:Role)

(:Permission)

(:AccessPolicy)

(:AccessRequest)

(:AuditEvent)

Code relationships:

(:File)-[:IMPORTS]->(:File)

(:Folder)-[:CONTAINS]->(:File)

(:File)-[:DEFINES]->(:Function)

Authorization relationships can be modeled separately.

Do not tightly couple security logic to dependency relationships.

Security policy should remain independently manageable.

==================================================
26. SECURITY VS GRAPH SEPARATION
==================================================

The dependency graph answers:

"What is connected to what?"

The authorization system answers:

"Who is allowed to see what?"

These should remain separate concepts.

Example:

Graph:

A → B → C

Permissions:

Alice:
A = source access
B = metadata only
C = metadata only

Bob:
A = source
B = source
C = source

The graph remains the same.

The user's authorized view changes.

==================================================
27. VERSIONING
==================================================

Permissions should be versionable.

Example:

Monday:
Alice can access 50 files.

Tuesday:
Admin grants access to 20 more.

Wednesday:
Alice loses access to 5 files.

The system should preserve the history.

This becomes especially important when combined with Git history.

==================================================
28. GIT INTEGRATION
==================================================

When GitHub integration is implemented, permissions must continue working across repository versions.

Example:

User can access:

main branch:
file A

but not:

private branch:
file B

Future architecture should support:

Repository
Branch
Commit
File snapshot

Authorization must apply to the requested snapshot/version.

==================================================
29. GRAPH SNAPSHOTS
==================================================

When permissions change, do not destroy historical architecture information.

A previous graph snapshot may show:

A → B

Current user permissions may differ.

Therefore separate:

Graph state

from:

Current authorization state.

==================================================
30. EXPORT SECURITY
==================================================

Exports must respect permissions.

Examples:

Export graph
Export JSON
Export architecture report
Download ZIP
Generate documentation

If a user cannot access source code:

Do not include source code in exports.

If metadata is allowed:

The export may include metadata-only nodes.

==================================================
31. AI SECURITY
==================================================

AI must never become an authorization bypass.

Pipeline:

User question
    ↓
Authenticate
    ↓
Determine repository
    ↓
Determine authorized resources
    ↓
Retrieve only authorized context
    ↓
Build AI prompt
    ↓
LLM
    ↓
Validate response
    ↓
Return answer

NEVER:

User question
    ↓
LLM receives entire repository
    ↓
LLM decides what it should reveal

The second architecture is insecure.

==================================================
32. SECRET PROTECTION
==================================================

The system should eventually detect and protect:

- API keys
- Passwords
- Tokens
- Private keys
- .env files
- Credentials
- Certificates
- Cloud secrets

Even users with repository access should potentially receive warnings when sensitive data is detected.

Implement this separately from RBAC.

==================================================
33. EDGE CASES
==================================================

The implementation must explicitly handle:

1. User has graph access but no source access.

2. User has source access but no download access.

3. User has metadata access but no graph access.

4. User loses permission while viewing a file.

5. User is removed from a team.

6. User's temporary permission expires.

7. User has access through multiple teams.

8. One team allows access while another denies access.

9. Folder allows access but child folder denies access.

10. File explicitly overrides folder permission.

11. Repository permission changes while user is online.

12. User attempts to access a deleted file.

13. User attempts to access an old Git commit.

14. User tries to access another repository by modifying an ID.

15. User tries to guess file IDs.

16. User calls APIs directly instead of using the UI.

17. User manipulates React state.

18. User modifies request payloads.

19. User attempts path traversal.

20. ZIP contains malicious paths.

21. ZIP contains symlinks.

22. ZIP contains extremely large files.

23. ZIP contains millions of files.

24. ZIP bomb / decompression bomb.

25. User tries to upload unauthorized repository content.

26. AI attempts to retrieve unauthorized files.

27. AI is asked to summarize restricted files.

28. AI is asked to infer restricted source code from accessible dependencies.

29. Search tries to reveal restricted source.

30. Export tries to include restricted source.

31. Admin accidentally grants access too broadly.

32. User belongs to multiple organizations.

33. User belongs to multiple repositories.

34. Repository is private.

35. Repository connection token expires.

36. GitHub permissions change.

37. User's GitHub membership changes.

38. Admin account is compromised.

39. Audit log is accessed by unauthorized users.

40. Permission cache becomes stale.

==================================================
34. PATH TRAVERSAL PROTECTION
==================================================

Never trust a client-provided path.

Reject attempts such as:

../../secret.txt

..\..\secret.txt

encoded traversal variants

Absolute paths

Symlink escapes

All filesystem operations must resolve paths safely inside the repository sandbox.

==================================================
35. ZIP SECURITY
==================================================

ZIP uploads must be treated as untrusted.

Protect against:

- ZIP bombs
- Path traversal
- Symlink attacks
- Extremely large archives
- Huge file counts
- Malicious filenames
- Unsupported archive structures

Apply:

- Maximum upload size
- Maximum extracted size
- Maximum file count
- Maximum nesting depth
- Safe extraction directory
- Filename/path validation

==================================================
36. CACHE SECURITY
==================================================

Be extremely careful with caching.

Do not cache:

"file content for repository X"

without including authorization context.

A response cached for Alice must never be returned to Bob.

Potential cache key:

organization
+
repository
+
user/permission context
+
resource
+
version

Authorization-sensitive caches must be invalidated when permissions change.

==================================================
37. PERFORMANCE
==================================================

Do not perform expensive authorization calculations for every graph node individually if the repository contains thousands of files.

Design for:

- Permission batching
- Cached effective permissions
- Bulk graph authorization
- Efficient Neo4j queries
- Pagination
- Lazy loading
- Incremental graph loading

Example:

Instead of:

1000 files
→ 1000 permission queries

Prefer:

1 permission resolution operation
→ authorized node set

==================================================
38. UI DESIGN
==================================================

Maintain the current CodeAtlas UI:

LEFT:
Project Explorer

CENTER:
Graph

RIGHT:
Inspector

Add visual access states.

Accessible node:

normal appearance

Metadata-only node:

slightly muted
lock icon
"Restricted"

Hidden node:

not displayed

Restricted edge:

optional muted/dashed relationship

Do not make restricted nodes visually confusing.

The goal is:

"I understand that something exists, but I understand why I cannot inspect it."

==================================================
39. USER EXPERIENCE
==================================================

When a user clicks a restricted file:

Do NOT simply show:

403 Forbidden

Instead show a useful explanation:

------------------------------------------

ACCESS RESTRICTED

You can see this file in the architecture graph,
but you don't have permission to view its source.

You can still see its relationships because your
repository role allows architecture visibility.

Requested permission:
Source Code Access

[Request Access]

------------------------------------------

==================================================
40. ADMIN UX
==================================================

Admin permission editor should be visual.

Example:

Repository
│
├── frontend
│   ├── components
│   └── pages
│
├── backend
│   ├── services
│   └── api
│
├── payments 🔒
│
└── secrets 🔒

Select:

payments/

Then configure:

Metadata     ✓
Graph        ✓
Source       ✗
Download     ✗
AI Context   ✗

Apply to:

Everyone
Team
Role
Individual user

==================================================
41. PERMISSION PREVIEW
==================================================

Admin should be able to impersonate/view the effective permissions of a user WITHOUT actually becoming that user.

Example:

"Preview as Alice"

The admin sees:

Alice's graph
Alice's accessible files
Alice's restricted files
Alice's available actions

This should be read-only.

Log that the preview occurred.

==================================================
42. SECURITY TESTING
==================================================

Create automated tests for authorization.

Test:

authorized user
unauthorized user
metadata-only user
expired permission
team inherited permission
explicit deny
cross-repository access
cross-organization access
path traversal
direct API access
AI retrieval
search
download
export

Security tests must verify that unauthorized data is NOT present in API responses.

Do not only test that the frontend hides it.

==================================================
43. IMPLEMENTATION PHASES
==================================================

Do NOT attempt to implement the entire enterprise system at once.

Phase 1:

Basic users

Basic roles

Repository permissions

File permissions

Metadata vs source access

Backend authorization middleware

Restricted graph nodes

Restricted inspector

Phase 2:

Teams

Folder inheritance

Explicit deny

Permission explanation

Access requests

Audit logs

Phase 3:

Temporary permissions

Permission versioning

Git-aware permissions

Exports

Search authorization

Phase 4:

AI authorization

AI context filtering

AI audit logs

Sensitive information protection

Phase 5:

Enterprise security

Advanced policies

Anomaly detection

Admin analytics

SSO

SCIM

OIDC/SAML

Multi-organization tenancy

==================================================
44. DEVELOPMENT REQUIREMENT
==================================================

Before writing implementation code:

1. Design the authorization model.
2. Define entities.
3. Define roles.
4. Define permissions.
5. Define inheritance rules.
6. Define deny/allow precedence.
7. Define API boundaries.
8. Define Neo4j schema.
9. Define frontend state.
10. Define graph access states.
11. Define threat model.
12. Define security test cases.

Then implement incrementally.

Do not prematurely build every enterprise feature.

==================================================
45. SUCCESS CRITERIA
==================================================

The feature is considered successful when:

1. Two users can see different source-code permissions.

2. Both can still see the same architecture graph where policy permits metadata visibility.

3. Unauthorized source code never reaches the browser.

4. Unauthorized source code never reaches the AI model.

5. Unauthorized source cannot be retrieved through direct API calls.

6. Search respects permissions.

7. Downloads respect permissions.

8. Exports respect permissions.

9. Permissions can be assigned through an admin portal.

10. Permissions can be assigned to users and teams.

11. Folder permissions can be inherited.

12. Explicit restrictions can override inherited permissions according to the defined policy.

13. Access requests work.

14. Audit logs record security-sensitive actions.

15. Permission changes are reflected correctly.

16. Temporary permissions expire.

17. Security tests cover authorization bypass attempts.

==================================================
46. IMPORTANT PRODUCT PRINCIPLE
==================================================

CodeAtlas should not merely answer:

"Can this user access this file?"

It should answer:

"What is this user allowed to know about this file?"

Therefore permissions should distinguish:

KNOW IT EXISTS
    ↓
SEE ITS METADATA
    ↓
SEE ITS GRAPH RELATIONSHIPS
    ↓
SEARCH IT
    ↓
SEE ITS STRUCTURE
    ↓
SEE ITS SOURCE
    ↓
DOWNLOAD IT
    ↓
USE IT AS AI CONTEXT
    ↓
MODIFY IT

These are different capabilities.

The system should allow organizations to configure them independently.

==================================================
47. FINAL ARCHITECTURAL PRINCIPLE
==================================================

The fundamental CodeAtlas security model is:

CODE GRAPH
+
AUTHORIZATION GRAPH
+
USER CONTEXT
=
AUTHORIZED ARCHITECTURE VIEW

The dependency graph represents the software.

The authorization system represents who may access what.

CodeAtlas combines the two at request time to produce a secure, personalized architecture view.

Build this in a modular way so that the same authorization engine can later protect:

- Graph
- Source
- Search
- Git history
- AI
- Exports
- Documentation
- Collaboration
- Analytics
- Desktop application

The system must prioritize least privilege, server-side enforcement, auditability, explainable permissions, and prevention of indirect information leakage.