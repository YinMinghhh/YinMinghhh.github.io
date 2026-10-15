import type { UIStrings } from "../types";

export default {
  nav: {
    home: "首页",
    posts: "文章",
    tags: "标签",
    about: "关于我",
    archives: "归档与标签",
    search: "搜索",
    projects: "项目",
    categories: "分类",
  },
  post: {
    publishedAt: "发布于",
    updatedAt: "更新于",
    sharePostIntro: "分享这篇文章：",
    sharePostOn: "分享到 {{platform}}",
    sharePostViaEmail: "通过邮件分享这篇文章",
    tagLabel: "标签",
    backToTop: "回到顶部",
    goBack: "返回",
    editPage: "编辑页面",
    previousPost: "上一篇",
    nextPost: "下一篇",
    category: "分类",
  },
  pagination: {
    prev: "上一页",
    next: "下一页",
    page: "第",
  },
  home: {
    socialLinks: "社交链接",
    featured: "精选",
    recentPosts: "最近文章",
    allPosts: "全部文章",
  },
  footer: {
    copyright: "版权所有",
    allRightsReserved: "保留所有权利。",
  },
  pages: {
    tagTitle: "标签",
    tagDesc: "带有该标签的文章。",

    tagsTitle: "标签",
    tagsDesc: "文章中使用的全部标签。",

    postsTitle: "文章",
    postsDesc: "按时间倒序排列。",

    archivesTitle: "归档与标签",
    archivesDesc: "按年月与标签浏览文章。",
    archiveHeading: "归档",

    searchTitle: "搜索",
    searchDesc: "搜索文章",

    projectsTitle: "项目",
    projectsEmpty: "整理中",

    categoriesTitle: "分类",
    categoriesDesc: "按文件夹划分的三个分类。",

    emptyPosts: "暂无文章",
    emptyTags: "暂无标签",
  },
  a11y: {
    skipToContent: "跳到正文",
    openMenu: "打开菜单",
    closeMenu: "关闭菜单",
    toggleTheme: "切换深色模式",
    searchPlaceholder: "搜索文章……",
    noResults: "没有找到结果",
    goToPreviousPage: "上一页",
    goToNextPage: "下一页",
    pagination: "分页",
    breadcrumb: "面包屑导航",
  },
  notFound: {
    title: "未找到页面",
    message: "页面不存在",
    goHome: "返回首页",
  },
} satisfies UIStrings;
