import hljs from 'highlightjs'

const initialize = () => {
  hljs.initHighlightingOnLoad();
}

window.addEventListener('DOMContentLoaded', initialize);
