"use strict";

const
  gulp = require("gulp"),
  gutil = require("gulp-util"),
  $ = require("gulp-load-plugins")(),
  browserify = require("browserify"),
  watchify = require("watchify"),
  source = require("vinyl-source-stream"),
  buffer = require("vinyl-buffer"),
  minimist = require("minimist"),
  exec = require('child_process').execSync,
  del = require("del"),
  runSequence = require("run-sequence"),
  browserSync = require("browser-sync"),
  bs = browserSync.create(),
  reload = bs.reload;

const minimistOptions = {
  string: "env",
  default: {
    env: process.env.NODE_ENV || "development"
  }
};

const options = minimist(process.argv.slice(2), minimistOptions);

let isProduction = false;

let initialBuild = true;

if (options.env === "production") {
  isProduction = true;
}

gutil.log("Environment:", gutil.colors.yellow(options.env));

const ROOT_PATH = 'themes/blog-fragment/';

const PATHS = {
  src: {
    html: ['content/**/*', `${ROOT_PATH}/layouts/**/*`, `${ROOT_PATH}/data/**/*`, 'config.toml', `${ROOT_PATH}/config.toml`],
    assets: ROOT_PATH + 'src/',
    stylesheets: ROOT_PATH + 'src/stylesheets/',
    javascripts: ROOT_PATH + 'src/javascripts/',
    images: ROOT_PATH + 'src/images/',
    fonts: ROOT_PATH + 'src/fonts/'
  },
  dist: {
    html: 'public/',
    assets: ROOT_PATH + 'static',
    stylesheets: ROOT_PATH + 'static/stylesheets/',
    javascripts: ROOT_PATH + 'static/javascripts/',
    images: ROOT_PATH + 'static/images/',
    fonts: ROOT_PATH + 'static/fonts/'
  }
}

const AUTOPREFIXER_BROWSER = ["last 2 versions"];

gulp.task("serve", () => {
  return bs.init({
    notify: false,
    server: [PATHS.dist.html]
  })
});

gulp.task("build", () => {
  if (initialBuild) initialBuild = !initialBuild;

  const result = exec('hugo -D');
  gutil.log(gutil.colors.green(`Error: ${result}`));
  return (!isProduction && bs.active) ? reload() : null;
});

gulp.task("html", () => {
  return gulp.start("build");
});

gulp.task("styles", () => {
  return gulp.src(`${PATHS.src.stylesheets}/*.scss`)
    .pipe($.plumber())
    .pipe($.if(!isProduction, $.sourcemaps.init()))
    .pipe($.sass().on("erorr", $.sass.logError))
    .pipe($.autoprefixer({ browsers: AUTOPREFIXER_BROWSER }))
    .pipe($.groupCssMediaQueries())
    .pipe($.csscomb())
    .pipe($.csso())
    .pipe($.if(!isProduction, $.sourcemaps.write("./")))
    .pipe(gulp.dest(PATHS.dist.stylesheets));
});

gulp.task("scripts", () => {
  let bundler;

  const options = {
    entries: [`${PATHS.src.javascripts}/index.js`],
    transform: [["babelify", { presets: ["es2015"] }]],
    plugin: ["babel-plugin-transform-object-rest-spread"]
  };

  const filename = "bundle.js";

  if (isProduction) {
    bundler = browserify(options);
  } else {
    options.cache = {};
    options.packageCache = {};
    options.fullPaths = true;
    options.debug = true;
    bundler = watchify(browserify(options));
  }

  function bundle() {
    return bundler
      .bundle()
      .on("error", errorHandler)
      .pipe(source(filename))
      .pipe(buffer())
      .pipe($.if(isProduction, $.uglify()))
      .pipe(gulp.dest(PATHS.dist.javascripts))
      .on("end", () => {
        gutil.log("Finished", "'" + gutil.colors.cyan("Browserify Bundled") + "'", gutil.colors.green(filename));
        if (!initialBuild && !isProduction && bs.active) gulp.start("build");
      });
  }

  bundler.on("update", bundle);
  return bundle();
});

gulp.task("minify", () => {
  return gulp.src("public/**/*.html")
    .pipe($.htmlmin({
      collapseWhitespace: true,
      minifyCSS: true,
      minifyJS: true,
      removeComments: true,
      useShortDoctype: true,
    }))
    .pipe(gulp.dest('./public'));
});

gulp.task("watch", () => {
  $.watch(PATHS.src.html, () => {
    gulp.start("html");
  });

  $.watch([PATHS.src.stylesheets + "/**/*.scss"], () => {
    runSequence("styles", "build");
  });
});

gulp.task("clean", (cb) => {
  return del(['public', `${PATHS.dist.javascripts}/*.js`, `${PATHS.dist.stylesheets}`], cb);

});

gulp.task("default", () => {
  if (!isProduction) {
    runSequence("clean", ["styles", "scripts"], "build", "serve", "watch");
  } else {
    runSequence("clean", ["styles", "scripts"], "build", "minify");
  }
});

const errorHandler = function(err) {
  gutil.log(gutil.colors.red(`Error: ${err}`));
  this.emit("end");
};
