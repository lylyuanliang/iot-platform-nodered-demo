CREATE DATABASE IF NOT EXISTS iot_nodered_demo DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE iot_nodered_demo;

CREATE TABLE IF NOT EXISTS product (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  product_key VARCHAR(64) NOT NULL UNIQUE,
  product_name VARCHAR(128) NOT NULL,
  device_type VARCHAR(64) NOT NULL,
  description VARCHAR(512),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS thing_model (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  product_key VARCHAR(64) NOT NULL,
  model_type ENUM('property','event','service') NOT NULL,
  identifier VARCHAR(128) NOT NULL,
  name VARCHAR(128) NOT NULL,
  data_type VARCHAR(32),
  unit VARCHAR(32),
  config_json JSON,
  description VARCHAR(512),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_model (product_key, model_type, identifier)
);

CREATE TABLE IF NOT EXISTS device_instance (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  device_id VARCHAR(128) NOT NULL UNIQUE,
  device_name VARCHAR(128) NOT NULL,
  product_key VARCHAR(64) NOT NULL,
  status ENUM('online','offline','fault') NOT NULL DEFAULT 'offline',
  location VARCHAR(128),
  last_report_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS telemetry_raw_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  event_id VARCHAR(128) NOT NULL UNIQUE,
  device_id VARCHAR(128) NOT NULL,
  source_type VARCHAR(32) NOT NULL,
  topic VARCHAR(128),
  raw_payload JSON NOT NULL,
  received_at DATETIME NOT NULL,
  parse_status ENUM('pending','success','failed') NOT NULL DEFAULT 'pending',
  error_message VARCHAR(1024)
);

CREATE TABLE IF NOT EXISTS telemetry_event (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  event_id VARCHAR(128) NOT NULL UNIQUE,
  raw_event_id VARCHAR(128),
  device_id VARCHAR(128) NOT NULL,
  product_key VARCHAR(64) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  properties_json JSON,
  occurred_at DATETIME NOT NULL,
  source_type VARCHAR(32) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS device_latest_state (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  device_id VARCHAR(128) NOT NULL UNIQUE,
  product_key VARCHAR(64) NOT NULL,
  status ENUM('online','offline','fault') NOT NULL DEFAULT 'offline',
  properties_json JSON,
  last_event_id VARCHAR(128),
  last_report_at DATETIME,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rule_execution_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  rule_code VARCHAR(128) NOT NULL,
  rule_name VARCHAR(128) NOT NULL,
  flow_name VARCHAR(128),
  node_name VARCHAR(128),
  event_id VARCHAR(128),
  device_id VARCHAR(128),
  matched BOOLEAN NOT NULL DEFAULT FALSE,
  result_type ENUM('pass','alarm','command','invalid','error') NOT NULL,
  input_payload JSON,
  output_payload JSON,
  error_message VARCHAR(1024),
  executed_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS alarm_record (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  alarm_id VARCHAR(128) NOT NULL UNIQUE,
  device_id VARCHAR(128) NOT NULL,
  product_key VARCHAR(64) NOT NULL,
  alarm_type VARCHAR(128) NOT NULL,
  alarm_level ENUM('info','warning','critical') NOT NULL,
  title VARCHAR(256) NOT NULL,
  detail VARCHAR(1024),
  source_event_id VARCHAR(128),
  source_rule_code VARCHAR(128),
  status ENUM('created','confirmed','processing','closed') NOT NULL DEFAULT 'created',
  handled_by VARCHAR(128),
  handled_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS command_record (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  command_id VARCHAR(128) NOT NULL UNIQUE,
  device_id VARCHAR(128) NOT NULL,
  product_key VARCHAR(64) NOT NULL,
  service_code VARCHAR(128) NOT NULL,
  command_source ENUM('rule','business','manual','timer') NOT NULL,
  source_alarm_id VARCHAR(128),
  request_payload JSON NOT NULL,
  status ENUM('created','queued','sent','running','success','failed','timeout','canceled') NOT NULL DEFAULT 'created',
  sent_at DATETIME,
  ack_payload JSON,
  ack_at DATETIME,
  error_message VARCHAR(1024),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
