import { BoardDescriptor } from "hkp-frontend/src/types";

export const WORKFLOW_REFINEMENT_SEED_KEY = "hkp-ai-workflow-refinement-seed";
export const WORKFLOW_REFINER_TEMPLATE_BOARD_NAME = "AI-Board-Refiner";

export type WorkflowRefinementSeed = {
  sourceBoardName: string;
  baseBoardSource: string;
  createdAt: string;
  initialPrompt?: string;
};

export function saveWorkflowRefinementSeed(seed: WorkflowRefinementSeed) {
  localStorage.setItem(WORKFLOW_REFINEMENT_SEED_KEY, JSON.stringify(seed));
}

export function consumeWorkflowRefinementSeed(): WorkflowRefinementSeed | null {
  const raw = localStorage.getItem(WORKFLOW_REFINEMENT_SEED_KEY);
  if (!raw) {
    return null;
  }

  localStorage.removeItem(WORKFLOW_REFINEMENT_SEED_KEY);

  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.sourceBoardName === "string" &&
      typeof parsed.baseBoardSource === "string"
    ) {
      return {
        sourceBoardName: parsed.sourceBoardName,
        baseBoardSource: parsed.baseBoardSource,
        createdAt:
          typeof parsed.createdAt === "string"
            ? parsed.createdAt
            : new Date().toISOString(),
        initialPrompt:
          typeof parsed.initialPrompt === "string"
            ? parsed.initialPrompt
            : undefined,
      };
    }
  } catch (_err) {
    return null;
  }

  return null;
}

export function createWorkflowRefinerTemplateBoard(): BoardDescriptor & {
  description: string;
} {
  const runtimeId = "rt-browser-refiner";
  const seed = consumeWorkflowRefinementSeed();

  let initialBoardPayload: any = {};
  if (seed?.baseBoardSource?.trim()) {
    try {
      initialBoardPayload = JSON.parse(seed.baseBoardSource);
    } catch (_err) {
      initialBoardPayload = {
        rawBoardSource: seed.baseBoardSource,
      };
    }
  }

  const wrappedBoardPayload = {
    boardSource: initialBoardPayload,
  };

  return {
    boardName: WORKFLOW_REFINER_TEMPLATE_BOARD_NAME,
    description:
      "AI refinement template: Injector emits current board JSON once, Workflow Builder refines, then push output to Board-Service preview.",
    runtimes: [
      {
        id: runtimeId,
        name: "Browser Runtime",
        type: "browser",
        state: {
          wrapServices: false,
          minimized: false,
        },
      },
    ],
    services: {
      [runtimeId]: [
        {
          uuid: "svc-injector-base-board",
          serviceId: "hookup.to/service/injector",
          serviceName: "Injector",
          state: {
            recentInjection: JSON.stringify(wrappedBoardPayload, null, 2),
            plainText: false,
          },
        },
        {
          uuid: "svc-workflow-board-builder-refiner",
          serviceId: "hookup.to/service/workflow-board-builder",
          serviceName: "Workflow Board Builder",
          state: {
            description:
              seed?.initialPrompt ||
              "Refine the current board while preserving unchanged behavior.",
            generatedBoardSource: "",
            isEditorOpen: false,
          },
        },
        {
          uuid: "svc-board-service-preview",
          serviceId: "hookup.to/service/board-service",
          serviceName: "Board-Service",
          state: {},
        },
      ],
    },
    registry: {},
  };
}
