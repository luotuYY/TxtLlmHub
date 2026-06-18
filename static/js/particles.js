const confettiShower = [];
const numConfettis = 50;
const container = document.getElementById("xuna");
const colors = [
"#f2abe7",
"#9fa3ec",
"#86d2e1",
"#fec31e"];

var _confettiRunning = true;

class Confetti {
  constructor() {
    this.w = Math.floor(Math.random() * 10 + 5);
    this.h = this.w * 1;
    this.x = Math.floor(Math.random() * 100);
    this.y = Math.floor(Math.random() * 100);
    this.c = colors[Math.floor(Math.random() * colors.length)];
  }
  create() {
    return '<div class="confetti" style="bottom:' + this.y + '%; left:' + this.x + '%;width:' +
    this.w + 'px; height:' + this.h + 'px;"><div class="rotate"><div class="askew" style="background-color:' + this.c + '"></div></div></div>';
  }
}

function animateConfetti() {
  var confettiHTML = '';
  for (var i = 1; i <= numConfettis; i++) {
    var confetti = new Confetti();
    confettiHTML += confetti.create();
  }
  container.innerHTML += confettiHTML;
  var confettis = document.querySelectorAll('.confetti');
  for (var i = 0; i < confettis.length; i++) {
    var opacity = Math.random() + 0.1;
    var animated = confettis[i].animate([
    { transform: 'translate3d(0,0,0)', opacity: opacity },
    { transform: 'translate3d(20vw,100vh,0)', opacity: 1 }],
    {
      duration: Math.random() * 3000 + 3000,
      iterations: Infinity,
      delay: -(Math.random() * 5000) });

    confettiShower.push(animated);
  }
}

// 页面不可见时暂停粒子动画，节省性能
document.addEventListener('visibilitychange', function () {
  if (document.hidden) {
    confettiShower.forEach(function (a) { try { a.pause(); } catch (e) {} });
    _confettiRunning = false;
  } else {
    confettiShower.forEach(function (a) { try { a.play(); } catch (e) {} });
    _confettiRunning = true;
  }
});

animateConfetti();
