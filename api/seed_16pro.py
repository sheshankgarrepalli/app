import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
import models

def seed_iphone_16_pro():
    db = SessionLocal()
    
    data = {
        "Desert Titanium": {
            128: ["MYNF3", "MYMC3", "MYMX3", "MYLQ3", "3N349"],
            256: ["MYNK3", "MYMJ3", "MYN23", "MYLV3", "3N737", "3N741", "3N745", "3N749", "3N753"],
            512: ["MYNP3", "MYMN3", "MYN63", "MYM23"],
            1024: ["MYNW3", "MYMT3", "MYNA3", "MYM73"],
        },
        "Natural Titanium": {
            128: ["MYNG3", "MYMD3", "MYMY3", "MYLR3", "3N350", "3N738"],
            256: ["MYNL3", "MYMK3", "MYN33", "MYLW3", "3N742", "3N746", "3N750", "3N754"],
            512: ["MYNQ3", "MYMP3", "MYN73", "MYM43"],
            1024: ["MYNX3", "MYMU3", "MYNC3", "MYM83"],
        },
        "White Titanium": {
            128: ["MYNE3", "MYMA3", "MYMW3", "MYLP3", "3N348"],
            256: ["MYNJ3", "MYMH3", "MYN13", "MYLU3", "3N740", "3N744", "3N748", "3N752"],
            512: ["MYNN3", "MYMM3", "MYN53", "MYLY3"],
            1024: ["MYNT3", "MYMR3", "MYN93", "MYM63"],
        },
        "Black Titanium": {
            128: ["MYND3", "MYM93", "MYMV3", "MYLN3", "3N347"],
            256: ["MYNH3", "MYMG3", "MYN03", "MYLT3", "3N739", "3N743", "3N747", "3N751"],
            512: ["MYNM3", "MYML3", "MYN43", "MYLX3"],
            1024: ["MYNR3", "MYMQ3", "MYN83", "MYM53"],
        }
    }
    
    models_to_add = []
    
    for color, storages in data.items():
        for storage, part_numbers in storages.items():
            for pn in part_numbers:
                # check if exists
                if not db.query(models.PhoneModel).filter_by(model_number=pn).first():
                    pm = models.PhoneModel(
                        model_number=pn,
                        brand="Apple",
                        name="iPhone 16 Pro",
                        color=color,
                        storage_gb=storage
                    )
                    models_to_add.append(pm)
    
    if models_to_add:
        db.add_all(models_to_add)
        db.commit()
        print(f"Added {len(models_to_add)} iPhone 16 Pro part numbers.")
    else:
        print("All part numbers already exist.")

if __name__ == "__main__":
    seed_iphone_16_pro()
