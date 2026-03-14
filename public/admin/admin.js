// /admin/admin.js
if (sessionStorage.getItem("admin_ok") !== "1") {
  location.href = "/admin/index.html";
}