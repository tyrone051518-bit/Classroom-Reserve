// lib/db.ts - Mock Database Interaction

export type Teacher = {
  id: string;
  name: string;
  email: string;
  dashboardUrl: string;
};

export type Class = {
  id: string;
  name: string;
  teacherId: string;
  scheduledTime: Date;
  teacherConfirmed: boolean;
};

// Mock data
const mockTeachers: Teacher[] = [
  { id: 'teacher1', name: 'Alice Smith', email: 'alice.smith@example.com', dashboardUrl: '/teacher/dashboard' },
  { id: 'teacher2', name: 'Bob Johnson', email: 'bob.johnson@example.com', dashboardUrl: '/teacher/dashboard' },
];

const mockClasses: Class[] = [
  { id: 'class1', name: 'Math 101', teacherId: 'teacher1', scheduledTime: new Date(Date.now() + 10 * 60 * 1000 + 5000), teacherConfirmed: false }, // 10 mins 5 secs from now
  { id: 'class2', name: 'History 201', teacherId: 'teacher2', scheduledTime: new Date(Date.now() + 20 * 60 * 1000), teacherConfirmed: false }, // 20 mins from now
  { id: 'class3', name: 'Science 101', teacherId: 'teacher1', scheduledTime: new Date(Date.now() - 5 * 60 * 1000), teacherConfirmed: false }, // 5 mins ago
];

export async function getUpcomingClasses(timeframeMinutes: number): Promise<Class[]> {
  const now = Date.now();
  const futureLimit = now + timeframeMinutes * 60 * 1000;
  return mockClasses.filter(c =>
    c.scheduledTime.getTime() > now && c.scheduledTime.getTime() <= futureLimit && !c.teacherConfirmed
  );
}

export async function getTeacherById(id: string): Promise<Teacher | undefined> {
  return mockTeachers.find(t => t.id === id);
}

export async function getClassById(id: string): Promise<Class | undefined> {
  return mockClasses.find(c => c.id === id);
}

export async function updateClassConfirmation(classId: string, confirmed: boolean): Promise<boolean> {
  const classToUpdate = mockClasses.find(c => c.id === classId);
  if (classToUpdate) {
    classToUpdate.teacherConfirmed = confirmed;
    return true;
  }
  return false;
}