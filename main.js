(function() {

  var mod = angular.module('App', []);

  mod.controller('FontListController', function($scope, Fonts, Storage, util) {

    util.merge($scope, Fonts);

    Storage.setupAttribute($scope, 'text', 'Hi there');
    Storage.setupAttribute($scope, 'side', 'right');
    Storage.setupAttribute($scope, 'theme', 'dark');
    Storage.setupAttribute($scope, 'selected', []);

    $scope.addFont = function(font) {
      $scope.selected.push(font.name);
    };

    $scope.removeFont = function(index) {
      $scope.selected.splice(index, 1);
    }

    $scope.removeAllFonts = function() {
      if (confirm('Sure about that?')) {
        $scope.selected = [];
      }
    }

    $scope.loadWebFont = function(font) {
      font.loadCallback = function() {
        $scope.$digest();
      }
      Fonts.queueWebFont(font);
    }

    $scope.getRandomFonts = function(limit) {
      var i = 0;
      while (i < limit) {
        var font = util.getRandom(Fonts.getAll());
        var exists = $scope.selected.indexOf(font) !== -1;
        if (!exists) {
          $scope.selected.push(font);
          i++;
        }
      }
    };

    Fonts.loadAll().then(function() {
      $scope.selected.forEach(function(name) {
        $scope.loadWebFont(Fonts.getByName(name));
      });
      $scope.fonts = Fonts.getAll();
    });

  });

  mod.service('Fonts', function($http, $q, util) {

    var GOOGLE_FONTS_API_URL = 'https://www.googleapis.com/webfonts/v1/webfonts?key=AIzaSyApru_pt7gpUGUzfvCkQj8RpS9jGGhkttQ'
    var GOOGLE_FONTS_API_URL = 'fonts/google.json'
    var SYSTEM_FONTS_URL = 'fonts/system.json';

    var all = [];
    var byName = {};
    var queuedWebFonts = [];

    function transformSystemFont(font) {
      font.loaded = true;
      font.display_variant = font.variant.replace(/Regular/, '400').replace(/Bold/, '700');
      return font;
    }

    function transformGoogleFont(font) {
      font.platform = 'Google Fonts';
      switch(font.variant) {
        case 'regular':
          font.display_variant = '400';
          break;
        case 'italic':
          font.display_variant = '400 Italic';
          break;
        default:
          font.display_variant = font.variant.replace(/(\d+)italic/, '$1 Italic');
      }
      font.fvd = (font.display_variant.match(/italic/i) ? 'i' : 'n') + (font.display_variant.charAt(0));
      return font;
    }

    function appendFonts(fontFamilies, transformFn) {
      fontFamilies.forEach(function(family) {
        var variants = family.variants;
        if (typeof variants === 'string') {
          variants = variants.split(/,\s*/);
        }
        variants.forEach(function(variant) {
          var font = transformFn({
            family: family.family,
            variant: variant
          });
          font.name = family.family + ' ' + font.display_variant;
          all.push(font);
          byName[font.name] = font;
        });
      });
    }

    function loadSystemFonts() {
      return $http.get(SYSTEM_FONTS_URL).then(function(response) {
        appendFonts(response.data, transformSystemFont);
      });
    }

    function loadGoogleFonts() {
      return $http.get(GOOGLE_FONTS_API_URL).then(function(response) {
        appendFonts(response.data.items, transformGoogleFont);
      });
    }

    function sortAll() {
      all.sort(function(a, b) {
        var result = util.alphanumericSort(a.family, b.family);
        if (result === 0) {
          var aVariant = a.display_variant || a.variant;
          var bVariant = b.display_variant || b.variant;
          if (aVariant.length !== bVariant.length) {
            result = aVariant.length - bVariant.length;
          } else {
            result = util.alphanumericSort(aVariant, bVariant);
          }
        }
        return result;
      });
    }

    function isGoogleFont(font) {
      return font.platform == 'Google Fonts';
    }

    function loadWebFonts() {
      WebFont.load({
        fontloading: function(familyName, fvd) {
          queuedWebFonts.some(function(font, i) {
            if (font.family === familyName && font.fvd === fvd) {
              font.loading = false;
              font.loaded = true;
              if (font.loadCallback) {
                font.loadCallback.call();
              }
              return true;
            }
          });
        },
        google: {
          families: queuedWebFonts.map(function(f) {
            return f.family + ':' + f.variant;
          })
        }
      });
    }

    function getWeightForVariant(variant) {
      var match = variant.match(/\d+/);
      return match ? match[0] : null;
    }

    function getStyleForVariant(variant) {
      var match = variant.match(/italic/i);
      return match ? 'italic' : null;
    }

    function getPostscriptFamilyName(font) {
      var postscriptFamily = font.family.replace(/\s/g, '');
      var postscriptFace = font.variant.replace(/[\s-]/g, '');
      return postscriptFamily + (postscriptFace == 'Regular' ? '' : '-' + postscriptFace);
    }

    var deferredLoadWebFonts = util.debounce(loadWebFonts, 200);

    this.getStyleForFont = function(font) {
      if (isGoogleFont(font)) {
        if (font.loaded) {
          return {
            'font-family': font.family,
            'font-weight': getWeightForVariant(font.variant),
            'font-style': getStyleForVariant(font.variant)
          };
        }
      } else {
        return {
          'font-family': getPostscriptFamilyName(font)
        };
      }
    }

    this.getAll = function() {
      return all;
    }

    this.getByName = function(name) {
      return byName[name];
    }

    this.loadAll = function() {
      return $q.all([loadSystemFonts(), loadGoogleFonts()]).then(sortAll);
    }

    this.queueWebFont = function(font) {
      if (isGoogleFont(font)) {
        if (!font.loaded) {
          font.loading = true;
          queuedWebFonts.push(font);
          deferredLoadWebFonts();
        }
      }
    }

  });

  mod.service('Storage', function() {

    this.setupAttribute = function(scope, name, defaultValue) {
      var json = typeof defaultValue == 'object';
      var set = localStorage.getItem(name) || defaultValue;
      scope[name] = json ? angular.fromJson(set) : set;
      scope.$watch(name, function(set) {
        localStorage.setItem(name, json ? angular.toJson(set) : set);
      }, true);
    }

  });

  mod.service('util', function($timeout) {

    function normalize(str) {
      return str.replace(/['*-]/g, '');
    }

    this.getRandom = function(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    }

    this.capitalize = function(str) {
      return str[0].toUpperCase() + str.slice(1);
    }

    this.nlbr = function(str) {
      return str.replace(/\n/, '<br>');
    }

    this.alphanumericSort = function(a, b) {
      var aNorm = normalize(a);
      var bNorm = normalize(b);
      if (aNorm < bNorm) {
        return -1;
      } else if (aNorm > bNorm) {
        return 1;
      }
      return 0;
    }

    this.debounce = function(srcFn, ms) {
      var promise;
      var fn = function() {
        var self = this, args = arguments;
        fn.cancel();
        promise = $timeout(function() {
          return srcFn.apply(self, args);
        }, ms || 0);
        return promise;
      }
      fn.cancel = function() {
        if (promise) {
          $timeout.cancel(promise);
          promise = null;
        }
      }
      return fn;
    }

    this.merge = function(target, src) {
      for (var key in src) {
        if(!src.hasOwnProperty(key)) continue;
        target[key] = src[key];
      };
    }

  });

  mod.filter('userFilter', function() {
    return function (font) {
      return font;
    }
  });

  mod.filter('capitalize', function(util) {
    return util.capitalize;
  });

  mod.filter('nlbr', function(util) {
    return util.nlbr;
  });

  mod.filter('getFont', function(Fonts) {
    return function(names) {
      var result = [];
      names.forEach(function(name) {
        var font = Fonts.getByName(name);
        if (font) {
          result.push(font);
        }
      });
      return result;
    }
  });

  mod.directive('onScrollEnter', function($window, util) {

    var parent;
    var waypoints = [];
    var currentWaypoint;

    function addWaypoint(el, enter) {
      var waypoint = {
        el: el,
        enter: enter
      };
      if (!parent) {
        parent = el.parentNode;
        angular.element(parent).on('scroll', util.debounce(checkWaypoints, 200));
      }
      waypoints.push(waypoint);
      return waypoint;
    }

    function removeWaypoint(waypoint) {
      waypoints = goog.array.filter(waypoints, function(w) {
        return w != waypoint;
      });
    }

    function checkWaypoints() {
      if (waypoints.length === 0) {
        return;
      }
      var scrollTop = parent.scrollTop;
      var scrollBottom = scrollTop + parent.offsetHeight;
      var i = 0;
      while (i < waypoints.length) {
        var w = waypoints[i];
        var top = w.el.offsetTop;
        if (top > scrollBottom) {
          // No need to check the rest of the elements, so break out.
          break;
        } else if (top >= scrollTop && top <= scrollBottom) {
          // Fire the handler and remove the waypoint from the array.
          w.enter();
          waypoints.splice(0, 1);
        } else {
          i++;
        }
      }
    }

    angular.element($window).on('load', checkWaypoints);

    return {
      restrict: 'A',
      link: function(scope, element, attr) {
        var waypoint = addWaypoint(element[0], function() {
          scope.$apply(attr['onScrollEnter']);
        });
        scope.$on('$destroy', function() {
          removeWaypoint(waypoint);
        });
      }
    };
  });

  mod.directive('textFitContainer', function($window, util) {

    var MIN_SIZE = 10;

    return {
      restrict: 'A',
      controller: function($element) {
        var fontSize;
        var container = $element[0];
        var elements = angular.element();

        function release() {
          angular.forEach(elements, function(el) {
            el.style.fontSize = '';
          });
        }

        function getSize() {
          fontSize = parseInt($window.getComputedStyle(elements[0]).fontSize, 10);
        }

        function fit() {
          release();
          getSize();
          while (canContinue()) {
            fontSize--;
            angular.forEach(elements, function(el) {
              el.style.fontSize = fontSize + 'px';
            });
          }
        }

        function canContinue() {
          return fontSize > MIN_SIZE && container.scrollHeight > container.clientHeight;
        }

        this.register = function(el) {
          elements.push(el);
        }

        this.fit = util.debounce(fit);
        angular.element($window).on('resize orientationchange', util.debounce(fit, 500));
      }
    }
  });

  mod.directive('textFit', function() {

    return {
      restrict: 'A',
      require: '^textFitContainer',
      scope: {
        text: '=textFit'
      },
      link: function(scope, element, attr, textFitContainer) {
        textFitContainer.register(element[0]);
        scope.$watch('text', function(text) {
          element.html(text);
          textFitContainer.fit();
        });
      }
    }
  });

})();
