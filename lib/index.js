const { src, dest, parallel, series, watch } = require("gulp");
const del = require('del');
// 热更新
const browserSync = require('browser-sync')
// 创建一个服务器
const bs = browserSync.create()

// 自动加载插件
const gulpLoadPlugins = require('gulp-load-plugins')
const plugins = gulpLoadPlugins()

const sass = require('gulp-sass')(require('sass'));
// const babel = require('gulp-babel');
// // gulp-swig动态数据模板编译输出html文件
// const swig = require('gulp-swig');
// const imagemin = require('gulp-imagemin');

// 读取当前的工作目录
const cwd = process.cwd()
let config = {
  // 用于存放默认配置
  build: {
    src: 'src',
    dist: 'dist',
    temp: 'temp',
    public: 'public',
    paths: {
      styles: 'assets/styles/*.scss',
      scripts: 'assets/scripts/*.js',
      pages: '*.html',
      images: 'assets/images/**',
      fonts: 'fonts/**'
    }
  }
}

try {
  const loadConfig = require(`${cwd}/pages.config.js`)
  config = Object.assign({}, config, loadConfig)
} catch (error) {
  // console.log(err);
}

// 样式编译
const style = () => {
  return src(config.build.paths.styles, { base: config.build.src, cwd: config.build.src })
    .pipe(sass())
    .pipe(dest(config.build.temp))
    .pipe(bs.reload({ stream: true }))
}

// 脚本编译
const script = () => {
  return src(config.build.paths.scripts, { base: config.build.src, cwd: config.build.src })
    .pipe(plugins.babel({ presets: [require('@babel/preset-env')] }))
    .pipe(dest(config.build.temp))
    .pipe(bs.reload({ stream: true }))
}

// html 文件编译
const html = () => {
  return src(config.build.paths.pages, { base: config.build.src, cwd: config.build.src })
    .pipe(plugins.swig({
      data: config.data, // 参数data为 html 文件中动态设置的数据
      defaults: { // 监听 html 文件时，因为 cache 原因，可能导致页面未及时更新，将 swig 的 cache 关掉即可
        cache: false
      }
    }))
    .pipe(dest(config.build.temp))
    .pipe(bs.reload({ stream: true }))
}

// 压缩图片
const image = () => {
  return src(config.build.paths.images, { base: config.build.src, cwd: config.build.src })
    .pipe(plugins.imagemin())
    .pipe(dest(config.build.dist))
  // .pipe(bs.reload)
}

const font = () => {
  return src(config.build.paths.fonts, { base: config.build.src, cwd: config.build.src })
    .pipe(plugins.imagemin())
    .pipe(dest(config.build.dist))
  // .pipe(bs.reload)
}

// 复制公共文件
const extra = () => {
  return src('**', { base: config.build.public, cwd: config.build.public })
    .pipe(dest(config.build.dist))
  // .pipe(bs.reload)
}

// 清除文件，在构建之前先清除 dist 目录
const clean = () => {
  return del([config.build.dist, config.build.temp])
}

// 单独创建一个任务
const server = () => {
  // 使用 watch 监听文件变化，实时更新浏览器内容
  // 监听样式文件
  watch(config.build.paths.styles, { cwd: config.build.src }, style)
  // 监听脚本文件
  watch(config.build.paths.scripts, { cwd: config.build.src }, script)
  // 监听html文件
  watch(config.build.paths.pages, { cwd: config.build.src }, html)

  // 监听图片、文件、公共文件
  // 这些文件在开发阶段仅仅时进行了压缩，没有损坏文件，与源文件无异，所以在开发阶段可以使用src目录下的文件即可
  // watch('src/assets/images/**', image)
  // watch('src/fonts/**', font)
  // watch('public/**', extra)
  watch([config.build.paths.images, config.build.paths.fonts], { cwd: config.build.src }, bs.reload)
  watch(['**'], { cwd: config.build.public }, bs.reload)

  bs.init({
    // 隐藏右上角连接信息
    notify: false,
    // 端口
    port: 6008,
    // 监听文件变化，热更新
    // 如果不用这个，可以在创建任务时，使用 bs.reload 进行更新
    // files: ['dist/**'],
    server: {
      // 根目录
      // baseDir: config.build.dist,
      // dist 目录没有找到的，会往后查找
      baseDir: [config.build.temp, config.build.src, config.build.public],
      // 优先于 baseDir,找不到时才去 baseDir 里找
      routes: {
        '/node_modules': 'node_modules'
      }

    }
  })
}

// 文件处理，html文件中有些引用是源文件的，上线时 dist 目录没有这些文件，会出问题
const useref = () => {
  return src(config.build.paths.pages, { base: config.build.temp, cwd: config.build.temp })
    .pipe(plugins.useref({ searchPath: [config.build.temp, '.'] }))
    .pipe(plugins.if('*.css', plugins.cleanCss())) // 压缩生成的 css文件
    .pipe(plugins.if('*.js', plugins.uglify()))
    .pipe(plugins.if('*.html', plugins.htmlmin({
      collapseWhitespace: true, // 清除换行、空格
      minifyCSS: true, // 压缩文件中的 css
      minifyJS: true
    })))
    .pipe(dest(config.build.dist))
}

// 组合任务 可用 serie、parallel
// 三者之间没有依赖关系，所以使用 parallel 较为合适
// const compile = parallel(style, script, html, image, font)
const compile = parallel(style, script, html)

// 上线阶段执行的任务
const build = series(clean, image, font, extra, parallel(series(compile, useref)))

// 开发阶段执行任务
const develop = series(compile, server)

module.exports = {
  clean,
  build,
  develop
}