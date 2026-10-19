// ============================================================
// 纯本地版 · 协作能力占位（LocalCollab）
// ------------------------------------------------------------
// 原双模式版有 collab.js，提供「成员管理 / 分享 / 角色权限」，
// 这些能力完全依赖 Supabase 云端，纯本地版没有服务器，无法实现。
// 本文件用同名同接口的轻量实现顶替，作用有三：
//   1. 让 crm.js / knowledge.js 里的 window.Collab.xxx 调用不报错；
//   2. 把「分享」按钮的点击变成一句友好提示，而不是静默失败；
//   3. 让「官方知识库」类条目的编辑权限判断恒为 true（本地模式下所有数据都属于你）。
// 不发起任何网络请求。
// ============================================================
window.Collab = (function () {
  const notice = () => {
    const msg = (window.I18N && I18N.getLang() === "en")
      ? "Sharing needs a cloud backend. This build is local-only — use Data Manager → Export to share a backup file."
      : "当前为纯本地版，不支持在线分享。需要备份给别人请用「数据管理 → 导出」生成备份文件。";
    if (window.U && U.toast) U.toast(msg);
  };

  return {
    ME: null,
    loadMe: async () => null,
    // 顶栏用户区由 auth.js 渲染；这里留空实现以保证调用安全
    renderUserBox: () => {},
    share: notice,
    shareSpace: notice,
    // 本地模式下没有任何权限约束
    isAdmin: () => true,
    canEditOfficial: () => true,
    openUserSettings: () => {
      const msg = (window.I18N && I18N.getLang() === "en")
        ? "This local build has no account settings. Data lives in this browser — use Data Manager to export a backup."
        : "纯本地版没有账号设置。数据保存在本机浏览器，可在「数据管理」里导出备份。";
      if (window.U && U.toast) U.toast(msg);
    },
    refresh: async () => {},
  };
})();
