export const nextTick = (function () {
  const callbacks = [] //存放所有回调
  let pending = false //记录当前是否有回调在执行
  let timerFunc //一个函数，包装了一个能添加到microtask的函数

  // 在这里执行所有的回调，而这个函数的执行时机在下一个事件循环中
  function nextTickHandler() {
    pending = false
    // 将callbacks数组复制执行，因为如果在nextTick的回调函数中继续执行Vue.nextTick()
    // 则cb会不断被push到callbacks中，导致callbacks一直执行
    const copies = callbacks.slice(0)
    callbacks.length = 0
    for (let i = 0; i < copies.length; i++) {
      copies[i]()
    }
  }

  // nextTick行为利用了微任务队列，可以访问它
  // 通过本地Promise.then或MutationObserver。
  // MutationObserver拥有更广泛的支持

  if (typeof Promise !== 'undefined' && isNative(Promise)) {
    var p = Promise.resolve()
    var logError = err => { console.error(err) }
    // 如果能用Promise则通过Promise.then把nextTickHandler添加到microtask
    timerFunc = () => {
      p.then(nextTickHandler).catch(logError)
      if (isIOS) setTimeout(noop)
    }
  } else if (typeof MutationObserver !== 'undefined' && (
    isNative(MutationObserver) ||
    MutationObserver.toString() === '[object MutationObserverConstructor]'
  )) {
    // 如果能用MutationObserver，则人为的创建一个textNode，
    // 并让MutationObserver监听这个textNode，在timerFunc中改变这个textNode，
    // 由此触发MutationObserver的回调(这里涉及MutationObserver的工作方式，看看MDN文档就好)，
    // 实现在下一次事件循环执行nextTickHandler的目的
    var counter = 1
    var observer = new MutationObserver(nextTickHandler)
    var textNode = document.createTextNode(String(counter))
    observer.observe(textNode, {
      characterData: true
    })
    timerFunc = () => {
      counter = (counter + 1) % 2
      textNode.data = String(counter)
    }
  } else {
    //都不行只能用setTimeout实现，将nextTickHandler添加到macrotask中
    timerFunc = () => {
      setTimeout(nextTickHandler, 0)
    }
  }

  return function queueNextTick(cb, ctx) {
    let _resolve
    callbacks.push(() => {
      if (cb) cb.call(ctx)
      if (_resolve) _resolve(ctx)
    })
    if (!pending) {
      pending = true
      timerFunc()
    }
    if (!cb && typeof Promise !== 'undefined') {
      return new Promise(resolve => {
        _resolve = resolve
      })
    }
  }
})()
// 首先nextTick是一个自执行函数，返回值是queueNextTick()函数(主要利用闭包来保存一些变量)。当Vue.nextTick()执行时，执行的就是queueNextTick()函数，在这里将回调放入callbacks数组保存。并且用了一个pending标志位做了一次判断，它的主要作用是保证timerFunc()这个函数在一轮事件循环中只执行一次(因为在执行timerFunc()前将它置为true，而只有下一轮事件循环开始时它才能被置为false)，timerFunc()这个函数仅仅包装了一个能添加到microtask的函数(如promise.then,MutationObserver)，具体注释中有。关于选用哪种方式利用事件循环，从代码中可以看出，优先使用Promise，不存在则使用MutationObserver，都不存在则用setTimeout。

// 清楚这个函数的工作原理差不多就明白了Vue异步更新DOM的原理了，因为Vue会把一轮事件循环(即一次task)中所有触发的watcher去重后添加到一个队列里，然后将这个队列交由Vue.nextTick()，即将这个队列添加到microtask中，这样在本次task结束后，按照规则就会取出所有的microtask执行它们，实现DOM的更新。