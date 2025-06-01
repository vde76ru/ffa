<?php
namespace App\Core;

class Bootstrap 
{
    private static bool $initialized = false;
    
    public static function init(): void 
    {
        if (self::$initialized) {
            return;
        }
        
        try {
            // 1. Config
            Config::get('app.name');
            
            // 2. Logger (изначально без БД)
            Logger::initialize();
            
            // 3. Database
            Database::getConnection();
            
            // 4. Cache
            if (class_exists('\App\Core\Cache')) {
                Cache::init();
            }
            
            // 5. Security
            if (class_exists('\App\Core\SecurityManager')) {
                SecurityManager::initialize();
            }
            
            // 6. Session
            Session::start();
            
            self::$initialized = true;
            
        } catch (\Exception $e) {
            error_log("Bootstrap error: " . $e->getMessage());
            throw $e;
        }
    }
}