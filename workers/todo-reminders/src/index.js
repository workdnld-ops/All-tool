// Retired service: keep an inert deployment while old cron changes propagate.
// No Firebase access, Web Push, or notification permissions are needed.
export default {
  fetch() {
    return Response.json({ service: "todo-reminders", retired: true }, { status: 410 });
  },
  scheduled() {},
};
