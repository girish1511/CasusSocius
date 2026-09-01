"use client";

import { useCallback, useEffect, useState } from "react";
import SubjectTabs from "./SubjectTabs";
import SubjectView from "./SubjectView";
import AddSubjectModal from "./AddSubjectModal";

interface Course {
  id: string;
  name: string;
}

export default function AppShell() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const refreshCourses = useCallback(async () => {
    const res = await fetch("/api/courses");
    if (!res.ok) return;
    const { courses } = await res.json();
    setCourses(courses);
    setActiveCourseId((prev) => prev ?? courses[0]?.id ?? null);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch-on-mount
    refreshCourses();
  }, [refreshCourses]);

  async function createCourse(name: string) {
    const res = await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const { course } = await res.json();
      setCourses((prev) => [...prev, course]);
      setActiveCourseId(course.id);
    }
    setShowAddModal(false);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-col items-center gap-1 px-6 pt-10 pb-6 text-center">
        <h1 className="font-serif text-4xl text-foreground">CasusSocius</h1>
        <p className="font-mono text-xs tracking-wide text-muted-strong">
          MBA study assistant
        </p>
      </header>

      <SubjectTabs
        courses={courses}
        activeCourseId={activeCourseId}
        onSelect={setActiveCourseId}
        onAddClick={() => setShowAddModal(true)}
      />

      {activeCourseId ? (
        <SubjectView courseId={activeCourseId} />
      ) : (
        <p className="p-6 text-sm text-muted-strong">
          {courses.length === 0
            ? "Add a subject to get started."
            : "Select a subject."}
        </p>
      )}

      {showAddModal && (
        <AddSubjectModal
          onCreate={createCourse}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
