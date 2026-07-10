"use client";

import { reorderWorkflowTemplateSteps } from "@/core/workflow/workflow.admin.actions";
import {
  DndContext,
  DragEndEvent,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useState } from "react";

type Step = {
  id: string;
  name: string;
  description: string | null;
  sequence: number;
  stepType: string;
  requiredRole: string | null;
  slaHours: number | null;
};

export function WorkflowStepSorter({
  workflowId,
  steps,
}: {
  workflowId: string;
  steps: Step[];
}) {
  const [items, setItems] = useState(steps);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);

    const reordered = arrayMove(items, oldIndex, newIndex).map(
      (item, index) => ({
        ...item,
        sequence: index + 1,
      })
    );

    setItems(reordered);

    const formData = new FormData();
    formData.set("workflowId", workflowId);
    formData.set(
      "orderedStepIds",
      reordered.map((item) => item.id).join(",")
    );

    await reorderWorkflowTemplateSteps(formData);
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-3">
          {items.map((step) => (
            <SortableStep key={step.id} step={step} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableStep({ step }: { step: Step }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: step.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-2xl border p-4 ${
        isDragging
          ? "border-cyan-400/40 bg-cyan-400/10"
          : "border-white/10 bg-slate-950/50"
      }`}
    >
      <div className="flex items-start gap-4">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="mt-1 cursor-grab rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 active:cursor-grabbing"
        >
          <GripVertical size={18} />
        </button>

        <div className="flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs text-slate-500">Step {step.sequence}</p>
              <h3 className="mt-1 font-semibold text-white">{step.name}</h3>
              <p className="mt-1 text-sm text-slate-400">
                {step.description || "No description."}
              </p>
            </div>

            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
              {step.stepType.replaceAll("_", " ")}
            </span>
          </div>

          <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <p className="text-slate-400">
              Role:{" "}
              <span className="text-slate-200">
                {step.requiredRole
                  ? step.requiredRole.replaceAll("_", " ")
                  : "None"}
              </span>
            </p>

            <p className="text-slate-400">
              SLA:{" "}
              <span className="text-slate-200">
                {step.slaHours ? `${step.slaHours} hours` : "No SLA"}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}