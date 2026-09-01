"use client";

interface Course {
  id: string;
  name: string;
}

export default function SubjectTabs({
  courses,
  activeCourseId,
  onSelect,
  onAddClick,
}: {
  courses: Course[];
  activeCourseId: string | null;
  onSelect: (id: string) => void;
  onAddClick: () => void;
}) {
  return (
    <nav className="flex flex-wrap items-center gap-1 border-b border-surface-border px-6">
      {courses.map((course) => {
        const active = course.id === activeCourseId;
        return (
          <button
            key={course.id}
            onClick={() => onSelect(course.id)}
            className={`border-b-2 px-3 py-3 text-sm transition-colors ${
              active
                ? "border-accent text-foreground"
                : "border-transparent text-muted-strong hover:text-foreground"
            }`}
          >
            {course.name}
          </button>
        );
      })}
      <button
        onClick={onAddClick}
        className="px-3 py-3 font-mono text-xs text-muted hover:text-accent"
      >
        + Add subject
      </button>
    </nav>
  );
}
