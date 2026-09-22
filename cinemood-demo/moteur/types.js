/* Généré par scripts/construire-demo.mjs — NE PAS MODIFIER À LA MAIN.
   Source : cinemood/src/lib/reco/types.ts
   Les types TypeScript ont été retirés ; la logique est identique. */

/* =====================================================================
   types.ts — Le vocabulaire du domaine CinéMood.
   Aucune dépendance : ce module est lisible par Next.js ET par le
   lanceur de tests natif de Node (`node --test`).
   ===================================================================== */

/** Un titre est soit un film, soit une série. */
                                           

/** Les cinq tonalités proposées à la fin du test de personnalité. */
                                                                                  

/** Rythme perçu du récit : sert à coller à l'énergie du moment. */
                                                  

/** Humeurs proposées sur l'écran d'accueil. */
                    
             
            
            
                
          
                
               
             
              

/** Avec qui la personne regarde : change la sévérité du filtrage. */
                                                                

/**
 * Classification d'âge, alignée sur le visa d'exploitation français.
 * `TP` = tous publics. L'ordre du tableau `ECHELLE_AGE` fait foi.
 */
                                                              

/** Préférence linguistique déclarée au test. */
                                                           

/** Préférence d'époque déclarée au test. */
                                                                      

/**
 * Un titre normalisé. Qu'il vienne de TMDB ou du catalogue de démonstration,
 * le moteur ne voit jamais que cette forme-là.
 */
                        
                                                    
             
                 
                    
                
                         
                
                                                              
                       
                                                               
                         
                   
                     
                         
                    
                 
                          
                          
               
                  
                                                               
                     
                                 
                                                                      
                        
                   
                        
                 
                                                                   
                         
                                                           
                              
                     
 

/**
 * Le vecteur de goûts : des poids par facette, entre -1 (rejet) et +1
 * (adoration). Initialisé par le test de personnalité, puis déplacé par
 * chaque interaction.
 */
                               
                                 
                                   
                                       
                                  
                               
                                        
                                    
                                    
 

/** Les facettes du vecteur de goûts, utile pour itérer proprement. */
                                              

/** Le profil complet d'un utilisateur. */
                                    
                 
                         
     
                                                         
                                                                
                                                                      
     
                         
                                                                  
                                
                         
                           
                             
                                                                     
                          
                                   
                                   
                       
                                                                           
                        
                                              
               
                      
                                                                         
                    
                     
 

/** Les signaux que l'app renvoie au moteur. */
                    
                 
                   
                   
                     
                  
                      
                  
                 
                  

/** Mémoire des interactions, servant aux pénalités et à la rotation. */
                             
                                                       
                              
                                                                      
                    
                                       
                  
                                                  
                                      
                                                                      
                                              
 

/** Le contexte de visionnage du moment. */
                           
                        
                       
                           
                
                                   
               
                                                                                 
                     
 

/** Le détail du score d'un titre : c'est lui qui rend l'algorithme lisible. */
                              
                
                 
                 
                  
                    
                    
                                                                                
                                                                             
 

/** Un titre recommandé, avec sa justification. */
                                 
               
                
                      
                                                                    
                  
     
                                                                     
                                                                         
                                                                 
     
                                  
                                                         
                   
 
