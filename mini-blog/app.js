/**
 * MiniBlog — 极简本地记录小站
 * 纯原生 JS：发布 + 查看，localStorage 持久化
 */
(function () {
  "use strict";

  var STORAGE_KEY = "mini-blog-posts";
  var MAX_LENGTH = 140;

  // ---- DOM 引用 ----
  var input = document.getElementById("compose-input");
  var charCount = document.getElementById("char-count");
  var publishBtn = document.getElementById("publish-btn");
  var errorMsg = document.getElementById("compose-error");
  var postList = document.getElementById("post-list");
  var emptyState = document.getElementById("empty-state");

  // ---- 数据层：localStorage 读写封装 ----

  function loadPosts() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      // 脏数据或存储不可用时回退为空数组，避免页面崩溃
      return [];
    }
  }

  function savePosts(posts) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
      return true;
    } catch (e) {
      // 隐私模式 / 配额满等情况
      alert("保存失败：浏览器本地存储不可用或已满，内容未被保存。");
      return false;
    }
  }

  // ---- 工具函数 ----

  function uid() {
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  // 相对时间只在渲染时计算一次，不设定时器刷新：刷新页面即更新，保持最小实现
  function formatTime(ts) {
    var diff = Date.now() - ts;
    var min = Math.floor(diff / 60000);
    if (min < 1) return "刚刚";
    if (min < 60) return min + " 分钟前";
    var hour = Math.floor(min / 60);
    if (hour < 24) return hour + " 小时前";
    var d = new Date(ts);
    var pad = function (n) { return String(n).padStart(2, "0"); };
    var sameYear = d.getFullYear() === new Date().getFullYear();
    return sameYear
      ? pad(d.getMonth() + 1) + "月" + pad(d.getDate()) + "日 " + pad(d.getHours()) + ":" + pad(d.getMinutes())
      : d.getFullYear() + "年" + pad(d.getMonth() + 1) + "月" + pad(d.getDate()) + "日";
  }

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.hidden = false;
  }

  function clearError() {
    errorMsg.hidden = true;
    errorMsg.textContent = "";
  }

  // ---- 渲染层 ----

  function renderPosts() {
    var posts = loadPosts(); // 倒序由发布时 unshift 保证，这里再兜底排序
    posts.sort(function (a, b) { return b.createdAt - a.createdAt; });

    postList.textContent = "";
    emptyState.hidden = posts.length > 0;

    var frag = document.createDocumentFragment();

    posts.forEach(function (post) {
      var card = document.createElement("article");
      card.className = "post card";

      var head = document.createElement("div");
      head.className = "post-head";

      var name = document.createElement("span");
      name.className = "post-name";
      name.textContent = "我";

      var time = document.createElement("span");
      time.className = "post-time";
      time.textContent = formatTime(post.createdAt);

      head.appendChild(name);
      head.appendChild(time);

      var content = document.createElement("p");
      content.className = "post-content";
      content.textContent = post.content; // textContent 防 XSS

      card.appendChild(head);
      card.appendChild(content);
      frag.appendChild(card);
    });

    postList.appendChild(frag);
  }

  // ---- 交互逻辑 ----

  function updateCharCount() {
    // 按码点计数，emoji 等代理对字符只算 1 个，与 publish 的校验口径保持一致
    var len = Array.from(input.value).length;
    charCount.textContent = len + " / " + MAX_LENGTH;
    charCount.classList.toggle("warn", len > MAX_LENGTH - 20 && len <= MAX_LENGTH);
    charCount.classList.toggle("over", len > MAX_LENGTH);
    // 空内容或超限时禁用按钮，避免无效提交
    publishBtn.disabled = input.value.trim().length === 0 || len > MAX_LENGTH;
  }

  function publish() {
    var content = input.value.trim();

    if (!content) {
      showError("内容不能为空，写点什么再发布吧");
      return;
    }
    if (Array.from(content).length > MAX_LENGTH) {
      showError("内容超出 " + MAX_LENGTH + " 字上限");
      return;
    }

    var posts = loadPosts();
    posts.unshift({ id: uid(), content: content, createdAt: Date.now() });

    if (savePosts(posts)) {
      input.value = "";
      clearError();
      updateCharCount();
      renderPosts();
      input.focus();
    }
  }

  // ---- 事件绑定 ----
  publishBtn.addEventListener("click", publish);

  input.addEventListener("input", function () {
    clearError();
    updateCharCount();
  });

  input.addEventListener("keydown", function (e) {
    // Ctrl/Cmd + Enter 快捷发布
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      publish();
    }
  });

  // 其他标签页改动同一份数据时同步列表；storage 事件不在写入页触发，无循环刷新风险
  window.addEventListener("storage", function (e) {
    if (e.key === STORAGE_KEY || e.key === null) {
      renderPosts();
    }
  });

  // ---- 初始化 ----
  updateCharCount();
  renderPosts();
})();
