/*! DragScroller v1.0.2 ~ (c) 2018 Yordan Nikolov */
(function (window, document, Math) {
	var requestAnimationFrame = window.requestAnimationFrame	||
		window.webkitRequestAnimationFrame	||
		window.mozRequestAnimationFrame		||
		window.oRequestAnimationFrame		||
		window.msRequestAnimationFrame		||
		function (callback) { window.setTimeout(callback, 1000 / 60); };

	var supportsWheel = "onwheel" in document.createElement("div") ? "wheel" : // Modern browsers support "wheel"
	        document.onmousewheel !== undefined ? "mousewheel" : // Webkit and IE support at least "mousewheel"
	            "DOMMouseScroll";

    var helpers = (function () {
    	var _elementStyle = document.createElement('div').style;

		var _vendor = (function () {
			var vendors = ['t', 'webkitT', 'MozT', 'msT', 'OT'],
				transform,
				i = 0,
				l = vendors.length;

			for ( ; i < l; i++ ) {
				transform = vendors[i] + 'ransform';
				if ( transform in _elementStyle ) return vendors[i].substr(0, vendors[i].length-1);
			}

			return false;
		})();

		var _transform = _prefixStyle('transform');

		function _prefixStyle (style) {
			if ( _vendor === false ) return false;
			if ( _vendor === '' ) return style;
			return _vendor + style.charAt(0).toUpperCase() + style.substr(1);
		}

		return  {
			style: {
				hasTransform: _transform !== false,
				hasPerspective: _prefixStyle('perspective') in _elementStyle,
				hasTouch: 'ontouchstart' in window,
				hasTransition: _prefixStyle('transition') in _elementStyle,
				transform: _transform,
				transitionTimingFunction: _prefixStyle('transitionTimingFunction'),
				transitionDuration: _prefixStyle('transitionDuration'),
				transitionDelay: _prefixStyle('transitionDelay'),
				transformOrigin: _prefixStyle('transformOrigin')
			},
			ease: {
				quadratic: {
					style: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
					fn: function (k) {
						return k * ( 2 - k );
					}
				},
				circular: {
					style: 'cubic-bezier(0.1, 0.57, 0.1, 1)',	// Not properly "circular" but this looks better, it should be (0.075, 0.82, 0.165, 1)
					fn: function (k) {
						return Math.sqrt( 1 - ( --k * k ) );
					}
				},
				back: {
					style: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
					fn: function (k) {
						var b = 4;
						return ( k = k - 1 ) * k * ( ( b + 1 ) * k + b ) + 1;
					}
				},
				bounce: {
					style: '',
					fn: function (k) {
						if ( ( k /= 1 ) < ( 1 / 2.75 ) ) {
							return 7.5625 * k * k;
						} else if ( k < ( 2 / 2.75 ) ) {
							return 7.5625 * ( k -= ( 1.5 / 2.75 ) ) * k + 0.75;
						} else if ( k < ( 2.5 / 2.75 ) ) {
							return 7.5625 * ( k -= ( 2.25 / 2.75 ) ) * k + 0.9375;
						} else {
							return 7.5625 * ( k -= ( 2.625 / 2.75 ) ) * k + 0.984375;
						}
					}
				},
				elastic: {
					style: '',
					fn: function (k) {
						var f = 0.22,
							e = 0.4;

						if ( k === 0 ) { return 0; }
						if ( k == 1 ) { return 1; }

						return ( e * Math.pow( 2, - 10 * k ) * Math.sin( ( k - f / 4 ) * ( 2 * Math.PI ) / f ) + 1 );
					}
				}
			}
		};
    })();

	function DragScroller (el) {
		this.el = el;
		this.scrollDistance = 0;
		this.startY = 0;
		this.distY  = 0;
		this.lastPointY = 0; // curYPos
		this.startTime = 0;
		this.endTime = 0;
		this.bounce = true;
		this.pointerDown = false;
		this.isAnimating = false;
		this.useTransition = false;
		this.isInTransition = true;
		this.dragging = false;
		this.wrapper = el.parentElement;
		this.wrapperHeight = el.parentElement.clientHeight;
		this.maxScroll = this.wrapperHeight - el.scrollHeight;

		this._onMouseMove = this._onMouseMove.bind(this);
		this._onMouseDown = this._onMouseDown.bind(this);
		this._onMouseUp = this._onMouseUp.bind(this);
		this._onMouseWheel = this._onMouseWheel.bind(this);

        el.addEventListener('touchstart', this._onMouseDown, false);
        el.addEventListener('mousedown', this._onMouseDown);
        el.addEventListener(supportsWheel, this._onMouseWheel);
	}

	DragScroller.prototype = {
		_onMouseMove: function (event) {
			var ev = this._normalizeEvent(event),
				timestamp = Date.now(),
				deltaY = ev.y - this.lastPointY,
	            newY = this.scrollDistance + deltaY;
            
            this.distY += deltaY;
            this.lastPointY = ev.y;

            
            if (timestamp - this.endTime > 300 && Math.abs(this.distY) < 10) {
                return;
            }

            if (this.pointerDown) {
                this.dragging = true;

				if (newY > 0 || newY < this.maxScroll) {
					newY = this.bounce ? this.scrollDistance + deltaY / 3 : newY > 0 ? 0 : this.maxScrollY;
				}

                this._translate(newY);

                if (timestamp - this.startTime > 300) {
                    this.startY = this.scrollDistance;
                    this.startTime = timestamp;
                }
            }

            event.stopPropagation();
            event.preventDefault();
		},
		_onMouseDown: function (event) {
			var ev = this._normalizeEvent(event);

            this.lastPointY = ev.y;
            this.startY = this.scrollDistance;
            this.pointerDown = true;
            this.isAnimating = false;
            this.startTime = Date.now();

            this.el.style[helpers.style.transitionDuration] = null;
            this.el.style[helpers.style.transitionTimingFunction] = null;

            this.el.addEventListener ('touchmove', this._onMouseMove, false);
            window.addEventListener('touchend', this._onMouseUp, false);
            
            this.el.addEventListener ('mousemove', this._onMouseMove);
            window.addEventListener('mouseup', this._onMouseUp);

            event.preventDefault();
		},
		_onMouseUp: function (event) {
        	var self = this,
	        	duration = Date.now() - this.startTime,
				newY = Math.round(this.scrollDistance),
				momentumY,
				momentumTime = 0,
				easing = '';

            this.pointerDown = false;
            this.endTime = Date.now();

            this.el.removeEventListener ('touchmove', this._onMouseMove, false);
            window.removeEventListener('touchend', this._onMouseUp, false);
            
            this.el.removeEventListener ('mousemove', this._onMouseMove);
            window.removeEventListener('mouseup', this._onMouseUp);

            this._scroll(newY);

            if (duration < 300) {
                momentumY = this._momentum(this.scrollDistance, this.startY, duration, this.maxScroll, this.wrapperHeight);
                newY = momentumY.destination;
                momentumTime = momentumY.duration;
                this.isInTransition = 1;
            }

            if (newY != this.scrollDistance) {
				if (newY > 0 || newY < this.maxScroll) {
					easing = helpers.ease.quadratic;
				}

				this._scroll(newY, momentumTime, easing);
			}

            var timeout = setTimeout(function () {
                self.dragging = false;
                clearTimeout(timeout);
            }, 100);

            event.preventDefault();
		},
		_onMouseWheel: function (ev) {
            /* Determine the direction of the scroll (< 0 → up, > 0 → down). */
            var delta = ((ev.deltaY || -ev.wheelDelta || ev.detail) >> 10) || 1;
            var newY = this.scrollDistance - (delta * 30);

            if (newY > 0 || newY < this.maxScroll) {
                newY = newY > 0 ? 0 : this.maxScroll;
            }

            this._translate(newY);
        
		},
		_normalizeEvent: function (ev) {
			if (ev.type === 'touchmove' || ev.type === 'touchstart' || ev.type === 'touchend') {
                var touch = ev.targetTouches[0] || ev.changedTouches[0];
                return {
                    x: touch.clientX,
                    y: touch.clientY,
                    id: touch.identifier
                };
            } else { // mouse events
                return {
                    x: ev.clientX,
                    y: ev.clientY,
                    id: null
                };
            }
		},
		_scroll: function (y, time , easing) {
			easing = easing || helpers.ease.circular;

            if (!time || this.useTransition) {
                this.el.style[helpers.style.transitionTimingFunction] = easing.style;
                this.el.style[helpers.style.transitionDuration] = time + 'ms';
                this._translate(y);
            } else {
                this._animate(y, time, easing);
            }
        },
        _translate: function (y) {
            this.el.style[helpers.style.transform] = 'translate3d(0px, '+ y +'px, 0px)';
            this.scrollDistance = y;
        },
        _animate: function (destY, duration, easingFn) {
            var self = this,
                startY = this.scrollDistance,
                startTime = Date.now(),
                destTime = startTime + duration;

            function step () {
                var now = Date.now(),
                    newY,
                    easing;

                if ( now >= destTime ) {
                    self.isAnimating = false;
                    self._translate(destY);
                    return;
                }

                now = (now - startTime) / duration;
                easing = easingFn.fn(now);
                newY = (destY - startY) * easing + startY;
                self._translate(newY);

                if (self.isAnimating) {
                    requestAnimationFrame(step);
                }
            }

            this.isAnimating = true;
            step();
        },
        _momentum: function (current, start, time, lowerMargin, wrapperSize, deceleration) {
            var distance = current - start,
                speed = Math.abs(distance) / time,
                destination,
                duration;

            deceleration = deceleration === undefined ? 0.0006 : deceleration;

            destination = current + ( speed * speed ) / ( 2 * deceleration ) * ( distance < 0 ? -1 : 1 );
            duration = speed / deceleration;

            if ( destination < lowerMargin ) {
                destination = wrapperSize ? lowerMargin - ( wrapperSize / 2.5 * ( speed / 8 ) ) : lowerMargin;
                distance = Math.abs(destination - current);
                duration = distance / speed;
            } else if ( destination > 0 ) {
                destination = wrapperSize ? wrapperSize / 2.5 * ( speed / 8 ) : 0;
                distance = Math.abs(current) + destination;
                duration = distance / speed;
            }

            return {
                destination: Math.round(destination),
                duration: duration
            };
        }
	};


	if ( typeof module != 'undefined' && module.exports ) {
		module.exports = DragScroller;
	} else {
		window.DragScroller = DragScroller;
	}

})(window, document, Math);