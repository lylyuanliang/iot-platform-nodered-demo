USE iot_nodered_demo;

INSERT INTO product (product_key, product_name, device_type, description) VALUES
('temperature-sensor', '温湿度传感器', 'sensor', '用于上报温度、湿度和在线状态'),
('alarm-light', '声光报警器', 'actuator', '用于执行声光报警联动'),
('cnc-machine', 'CNC 设备', 'machine', '用于演示高风险停机指令'),
('voice-speaker', '音柱', 'actuator', '用于播放业务处置语音提示')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name),
  device_type = VALUES(device_type),
  description = VALUES(description);

INSERT INTO thing_model (product_key, model_type, identifier, name, data_type, unit, config_json, description) VALUES
('temperature-sensor','property','temperature','温度','number','℃', JSON_OBJECT('min', -40, 'max', 125, 'alarmThreshold', 80), '温度属性'),
('temperature-sensor','property','humidity','湿度','number','%', JSON_OBJECT('min', 0, 'max', 100), '湿度属性'),
('temperature-sensor','property','online','在线状态','boolean', NULL, JSON_OBJECT(), '在线状态'),
('temperature-sensor','event','HighTemperature','高温事件','object', NULL, JSON_OBJECT('level', 'warning'), '温度超过阈值'),
('alarm-light','service','turnOnAlarm','打开声光报警','object', NULL, JSON_OBJECT('params', JSON_ARRAY('level','durationSeconds')), '打开声光报警器'),
('cnc-machine','service','stopMachine','停止设备','object', NULL, JSON_OBJECT('params', JSON_ARRAY('reason')), '停止 CNC 设备'),
('voice-speaker','service','playVoice','播放语音','object', NULL, JSON_OBJECT('params', JSON_ARRAY('text','volume')), '播放语音提示')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  data_type = VALUES(data_type),
  unit = VALUES(unit),
  config_json = VALUES(config_json),
  description = VALUES(description);

INSERT INTO device_instance (device_id, device_name, product_key, status, location) VALUES
('TEMP-SENSOR-001','一号温湿度传感器','temperature-sensor','online','车间A'),
('ALARM-LIGHT-001','一号声光报警器','alarm-light','online','车间A'),
('CNC-001','一号 CNC 设备','cnc-machine','online','车间A'),
('VOICE-SPEAKER-001','一号音柱','voice-speaker','online','车间A')
ON DUPLICATE KEY UPDATE
  device_name = VALUES(device_name),
  product_key = VALUES(product_key),
  status = VALUES(status),
  location = VALUES(location);
