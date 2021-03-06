'use strict';

var yeoman = require('yeoman-generator');
var chalk = require('chalk');
var yosay = require('yosay');
var jf = require('jsonfile');
var request = require('request');
var xml2js = require('xml2js');

module.exports = yeoman.generators.Base.extend({
  initializing: function () {
    this.log(yosay(
      'Welcome to ' + chalk.red('Gadget') + ', the gnarly generator for Grunt Drupal Tasks!'
    ));

    this.pkg = require('../package.json');
  },

  prompting: function () {
    var done = this.async();

    var prompts = [{
      type: 'list',
      name: 'drupalCoreVersion',
      message: 'Which version of ' + chalk.red('Drupal core') + ' would you like to use?',
      default: '8.x',
      choices: [
        {'name': 'Drupal 8', 'value': '8.x'},
        {'name': 'Drupal 7', 'value': '7.x'}
      ]
    }];

    this.prompt(prompts, function (props) {
      this.drupalCoreVersion = props.drupalCoreVersion;

      this.log("\nOk, I'm going to start assembling this project...");
      done();
    }.bind(this));
  },

  // Install Grunt Drupal Tasks, either the latest published version or the
  // current development version in the master branch.
  installGDT: function () {
    var done = this.async(),
      self = this,
      spid;

    if (this.options['skip-install']) {
      return done();
    }

    this.log('\nInstalling latest version of Grunt Drupal Tasks...');
    this.npmVersion = this.options['use-master'] ? 'git+https://github.com/phase2/grunt-drupal-tasks.git#master' : 'grunt-drupal-tasks';
    spid = this.spawnCommand('npm', ['install', this.npmVersion]);
    spid.on('close', function (code) {
      if (code) {
        self.log.error('\nAn error occurred while fetching Grunt Drupal Tasks.\n');
        process.exit(1);
      }

      jf.readFile('./node_modules/grunt-drupal-tasks/package.json', function(err, obj) {
        if (err || !obj || !obj.version) {
          self.log.error('\nAn error occurred while installing Grunt Drupal Tasks.\n');
          process.exit(1);
        }

        self.log('\nInstalled version ' + chalk.red(obj.version) + ' of Grunt Drupal Tasks.\n');
        done();
      });
    });
  },

  // Determine the latest stable release for the requested Drupal core version.
  getDrupalCoreRelease: function () {
    var done = this.async(),
      self = this;

    // Provide a fallback value in case the request fails.
    this.drupalCoreRelease = this.drupalCoreVersion;

    // Find the latest stable release for the Drupal core version.
    request('https://updates.drupal.org/release-history/drupal/' + this.drupalCoreVersion, function (error, response, body) {
      if (!error && response.statusCode == 200 && body.length) {
        xml2js.parseString(body, function (err, result) {
          if (!err && result && result.project && result.project.releases && result.project.releases[0] && result.project.releases[0].release && result.project.releases[0].release[0] && result.project.releases[0].release[0].version) {
            self.drupalCoreRelease = result.project.releases[0].release[0].version[0];
            self.log('Setting up Drush makefile to install Drupal version ' + chalk.red(self.drupalCoreRelease) + '.\n');
          }
          else {
            self.log.error('Could not parse latest version of Drupal for Drush makefile.\n');
          }
          done();
        });
      }
      else {
        self.log.error('Could not retrieve latest version of Drupal for Drush makefile.\n');
        done();
      }
    });
  },

  writing: {
    template: function () {
      this.directory(
        this.destinationPath('node_modules/grunt-drupal-tasks/example'),
        this.destinationPath()
      );

      this.directory(
        this.templatePath(this.drupalCoreVersion),
        this.destinationPath()
      );

      // If the latest published version of GDT is not used, then update the
      // project's package.json accordingly.
      if (this.npmVersion !== 'grunt-drupal-tasks') {
        var pkg = this.fs.readJSON('package.json');
        if (pkg) {
          pkg.dependencies['grunt-drupal-tasks'] = this.npmVersion;
          this.fs.writeJSON('package.json', pkg);
        }
      }
    },

    gitignore: function () {
      this.fs.move(
        this.destinationPath('gitignore'),
        this.destinationPath('.gitignore')
      );
    },

    drushMakefile: function () {
      var tokens = {
        drupalCoreRelease: this.drupalCoreRelease,
        coreCompatibility: this.drupalCoreVersion
      };
      this.fs.copyTpl(
        this.templatePath('project.make'),
        this.destinationPath('src/project.make'),
        tokens
      );
    }
  },

  install: function () {
    this.installDependencies({
      skipInstall: this.options['skip-install']
    });
  },

  end: function () {
    this.log('\nGadget has ' + chalk.red('finished') + ' setting up the Drupal project scaffold with Grunt Drupal Tasks!\n');
    this.log('Run `' + chalk.red('grunt') + '` to run the first build of this project.\n');
  }
});
