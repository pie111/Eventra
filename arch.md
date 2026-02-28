## Architecture Overview

The following **Event-Driven LLM Agent Architecture** shows the main components of Eventra:

```mermaid
flowchart TB

%% ===== Client Layer =====
User[User / Client App] --> API[API Gateway]

%% ===== Orchestration Layer =====
API --> ORCH[Agent Orchestrator]

ORCH --> LLM[LLM Engine]
ORCH --> TASKDB[(Task Store / Database)]
ORCH --> MEMORY[(Vector Memory)]
ORCH --> TOOLS[Tool Registry]

%% ===== Background Processing =====
TASKDB --> WORKER[Background Worker / Scheduler]
WORKER --> EVAL[Condition Evaluator]
EVAL --> TOOLS
EVAL --> TASKDB

%% ===== Event & Notification Layer =====
WORKER --> NOTIFY[Notification Service]
NOTIFY --> User

%% ===== Optional Event Bus =====
ORCH --> BUS[(Event Bus)]
BUS --> WORKER

%% ===== Tool External Calls =====
TOOLS --> EXTAPI[External APIs / Services]
```




The diagram above illustrates **Eventra’s architecture**: a stateful, event-driven LLM agent system.

* **Client / User App**: Submits requests or monitoring tasks.
* **API Gateway**: Handles authentication and routes requests.
* **Agent Orchestrator**: Interprets user intent via the LLM and decides whether to execute immediately or create a persistent task.
* **Task Store / Vector Memory**: Keeps tasks, workflows, and embeddings for long-term state.
* **Tool Registry**: Provides functions or APIs the agent can call.
* **Background Worker**: Periodically evaluates persistent tasks and triggers notifications.
* **Notification Service**: Alerts the user when task conditions are met.
* **External APIs / Services**: Supplies real-world data for tools to operate.

This architecture supports both **immediate tool execution** and **asynchronous monitoring**, giving the system flexibility to respond instantly or act autonomously over time.

```mermaid
sequenceDiagram
    participant User as User / Client App
    participant API as API Gateway
    participant ORCH as Agent Orchestrator
    participant LLM as LLM Engine
    participant TASKDB as Task Store
    participant WORKER as Background Worker
    participant TOOLS as Tool Registry
    participant NOTIFY as Notification Service
    participant EXT as External APIs / Services

    %% Step 1: User request
    User->>API: Submit request (e.g., "Get current AAPL price" or "Notify me if AAPL > $200")
    
    %% Step 2: API forwards to orchestrator
    API->>ORCH: Forward request
    
    %% Step 3: Orchestrator calls LLM
    ORCH->>LLM: Interpret intent → Decide tool and type of execution
    
    %% Step 4: Branch: Immediate vs Scheduled
    LLM-->>ORCH: Return structured task + execution type
    alt Immediate Execution
        ORCH->>TOOLS: Execute requested tool
        TOOLS->>EXT: Fetch data / perform action
        EXT-->>TOOLS: Return result
        TOOLS-->>ORCH: Return result
        ORCH-->>User: Return response immediately
    else Scheduled / Persistent Task
        ORCH->>TASKDB: Save task with condition & schedule
        ORCH-->>User: Acknowledge task added (will notify later)
    end

    %% Step 5: Background worker loop (for persistent tasks)
    WORKER->>TASKDB: Fetch active tasks periodically
    TASKDB-->>WORKER: Return tasks
    WORKER->>TOOLS: Execute required tools for task
    TOOLS->>EXT: Fetch external data
    EXT-->>TOOLS: Return result
    TOOLS-->>WORKER: Return data
    WORKER->>WORKER: Evaluate condition
    alt Condition met
        WORKER->>NOTIFY: Send alert to user
        NOTIFY-->>User: "Task condition met!"
        WORKER->>TASKDB: Mark task as completed
    else Condition not met
        WORKER->>TASKDB: Keep task active for next check
    end
```
