export function courseImage(course) {
  if (!course?.image) return null;
  const version = course.updatedAt ? `?v=${encodeURIComponent(course.updatedAt)}` : '';
  return `/api/files/course/${course.id}${version}`;
}
